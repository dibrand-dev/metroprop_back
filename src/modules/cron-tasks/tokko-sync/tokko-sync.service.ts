import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { TokkoSyncState } from './entities/tokko-sync-state.entity';
import { Property } from '../../properties/entities/property.entity';
import { PropertyImage } from '../../properties/entities/property-image.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { OrganizationsService } from '../../organizations/organizations.service';
import { PartnersService } from '../../partners/partners.service';

import { TokkoHelperService } from '../../../common/helpers/tokko-helper';
import { BranchesService } from '../../branches/branches.service';
import { UsersService } from '../../users/users.service';
import { MediaUploadStatus, UserRole } from '../../../common/enums';
import { TokkoSyncLoggerService } from './tokko-sync-logger.service';
import { PASSWORD_DEFAULT } from '@/common/constants';
import { PropertyWriteService } from '@/modules/properties/property-write.service';


@Injectable()
export class TokkoSyncService implements OnModuleInit {
	private readonly logger = new Logger(TokkoSyncService.name);
	private readonly BATCH_SIZE = 100;
	private tokkoPartnerId: number | null = null;

	constructor(
		@InjectRepository(TokkoSyncState)
		private readonly syncStateRepo: Repository<TokkoSyncState>,
		@InjectRepository(Property)
		private readonly propertyRepo: Repository<Property>,
		@InjectRepository(PropertyImage)
		private readonly propertyImageRepo: Repository<PropertyImage>,
		@InjectRepository(Organization)
		private readonly organizationRepo: Repository<Organization>,
		@InjectRepository(Branch)
		private readonly branchRepo: Repository<Branch>,
		private readonly tokkoHelperService: TokkoHelperService,
		private readonly branchesService: BranchesService,
		private readonly organizationsService: OrganizationsService,
		private readonly partnersService: PartnersService,
		private readonly usersService: UsersService,
		private readonly configService: ConfigService,
		private readonly fileLogger: TokkoSyncLoggerService,
		private readonly propertyWriteService: PropertyWriteService,
		
		
	) {}

	async onModuleInit(): Promise<void> {
		await this.resolveTokkoPartnerId();
	}

	@Cron('0 */10 * * * *')
	async handleCron(): Promise<void> {
		const apiKey = this.configService.get<string>('TOKKO_METROPROP_API_KEY');
		if (!apiKey) {
			this.logger.warn('[TokkoSync] TOKKO_METROPROP_API_KEY not set — skipping sync');
			return;
		}

		const enabled = this.configService.get<string>('FEATURE_FLAG_TOKKO_SYNC');
		if (enabled === 'false') {
			this.logger.debug('[TokkoSync] Sync disabled via FEATURE_FLAG_TOKKO_SYNC=false');
			return;
		}

		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return;
		}

		await this.syncFreePortalFeed(apiKey);
		await this.syncDeletedFeed(apiKey);
	}

	async triggerManualSync(): Promise<{ message: string }> {
		const apiKey = this.configService.get<string>('TOKKO_METROPROP_API_KEY');
		if (!apiKey) {
			return { message: 'TOKKO_METROPROP_API_KEY not configured' };
		}
		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return { message: 'Partner "tokko" not configured. Sync skipped.' };
		}

		await this.syncFreePortalFeed(apiKey);
		await this.syncDeletedFeed(apiKey);
		return { message: 'Sync triggered' };
	}

	async syncSingleProperty(publicationId: string): Promise<{
		outcome: 'created' | 'updated' | 'skipped' | 'not_found';
		message: string;
	}> {
		const apiKey = this.configService.get<string>('TOKKO_METROPROP_API_KEY');
		if (!apiKey) {
			return { outcome: 'skipped', message: 'TOKKO_METROPROP_API_KEY not configured' };
		}

		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return { outcome: 'skipped', message: 'Partner "tokko" not configured' };
		}

		this.logger.log(`[TokkoSync] syncSingleProperty publication_id=${publicationId}`);
		this.fileLogger.info(`SINGLE_SYNC_START publication_id=${publicationId}`);

		const result = await this.tokkoHelperService.fetchFreePortalPropertyById(apiKey, publicationId);

		if ('error' in result) {
			if (result.notFound) {
				this.fileLogger.warn(`SINGLE_SYNC_NOT_FOUND publication_id=${publicationId}`   + result.details ? ` details=${result.details}` : '');
				return { outcome: 'not_found', message: result.error };
			}
			const msg = result.details ? `${result.error}: ${result.details}` : result.error;
			this.logger.error(`[TokkoSync] syncSingleProperty HTTP error: ${msg}`);
			this.fileLogger.error(`SINGLE_SYNC_ERROR publication_id=${publicationId} ${msg}`);
			return { outcome: 'skipped', message: msg };
		}

		const { item } = result;
		this.fileLogger.logItemReceived(item);
		try {
			const outcome = await this.processProperty(item);
			const msg = `publication_id=${publicationId} outcome=${outcome}`;
			this.logger.log(`[TokkoSync] syncSingleProperty done — ${msg}`);
			this.fileLogger.info(`SINGLE_SYNC_DONE ${msg}`);
			return { outcome, message: `Property ${outcome} successfully` };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.error(`[TokkoSync] syncSingleProperty failed — ${msg}`);
			this.fileLogger.logItemFailed(item, err);
			return { outcome: 'skipped', message: msg };
		}
	}

	async syncOrganization(
		apiKey: string,
		tokkoOrganizationId: string,
		limit: number = 500,
		offset: number = 0,
	): Promise<{
		message: string;
		processed: number;
		total: number;
		pending: number;
		created: number;
		updated: number;
		skipped: number;
		failed: number;
	}> {
		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return {
				message: 'Partner "tokko" not configured. Sync skipped.',
				processed: 0, total: 0, pending: 0,
				created: 0, updated: 0, skipped: 0, failed: 0,
			};
		}

		this.logger.log(`[TokkoSync] syncOrganization org=${tokkoOrganizationId} limit=${limit} offset=${offset}`);
		this.fileLogger.orgInfo(tokkoOrganizationId, `ORG_SYNC_START org=${tokkoOrganizationId} limit=${limit} offset=${offset}`);

		const result = await this.tokkoHelperService.fetchFreePortalProperties(
			apiKey,
			limit,
			offset,
			'2000-01-01T00:00:00',
			tokkoOrganizationId,
		);

		if ('error' in result) {
			const msg = result.details ? `${result.error}: ${result.details}` : result.error;
			this.logger.error(`[TokkoSync] syncOrganization API error: ${msg}`);
			this.fileLogger.orgError(tokkoOrganizationId, `ORG_SYNC_API_ERROR ${msg}`);
			throw new Error(msg);
		}

		const { objects, meta } = result;
		const totalCount: number = meta.total_count ?? objects.length;
		const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };

		for (const item of objects) {
			const pubId = item?.publication_id != null ? String(item.publication_id) : 'N/A';
			try {
				const outcome = await this.processProperty(item);
				if (outcome === 'created') stats.created++;
				else if (outcome === 'updated') stats.updated++;
				else stats.skipped++;
				this.fileLogger.orgInfo(tokkoOrganizationId, `ITEM pub_id=${pubId} outcome=${outcome}`);
			} catch (err) {
				stats.failed++;
				const msg = err instanceof Error ? err.message : String(err);
				this.logger.error(
					`[TokkoSync] syncOrganization error processing item id=${item.id}: ${msg}`,
				);
				this.fileLogger.orgError(tokkoOrganizationId, `ITEM_FAILED pub_id=${pubId} error="${msg}"`, err);
			}
		}

		const processed = objects.length;
		const pending = Math.max(0, totalCount - offset - processed);

		const message = pending > 0
			? `${processed} de ${totalCount} procesadas, ${pending} pendientes`
			: `${processed} de ${totalCount} procesadas`;

		this.logger.log(`[TokkoSync] syncOrganization done — ${message}`);
		this.fileLogger.orgInfo(
			tokkoOrganizationId,
			`ORG_SYNC_DONE ${message} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} failed=${stats.failed}`,
		);
		return { message, processed, total: totalCount, pending, ...stats };
	}

	// ─── Sync Orchestration ──────────────────────────────────────────────────────

	private async syncFreePortalFeed(apiKey: string): Promise<void> {
		await this.runPaginatedSync(apiKey, 'feed', 'updated', (item) => this.processProperty(item));
	}

	private async syncDeletedFeed(apiKey: string): Promise<void> {
		await this.runPaginatedSync(apiKey, 'deleted', 'deleted', (item) => this.processDeletedProperty(item));
	}

	/**
	 * Generic paginated sync engine. Manages TokkoSyncState lifecycle
	 * (create/resume/advance/complete) and delegates per-item processing
	 * to the supplied callback.
	 */
	private async runPaginatedSync(
		apiKey: string,
		syncType: string,
		filter: string,
		processItem: (item: any) => Promise<string>,
	): Promise<void> {
		const label = `[TokkoSync:${syncType}]`;
		this.logger.log(`${label} Starting sync cycle`);

		// Load or create state row for this API key + sync type
		let state = await this.syncStateRepo.findOne({
			where: { api_key: apiKey, sync_type: syncType },
		});

		if (!state) {
			state = this.syncStateRepo.create({
				api_key: apiKey,
				sync_type: syncType,
				sync_from_date: new Date('2000-01-01'),
				current_offset: 0,
				total_count: 0,
				is_complete: true,
			});
			state = await this.syncStateRepo.save(state);
		}

		// If previous run finished, start a new one
		if (state.is_complete) {
			state.sync_from_date = state.completed_at ?? new Date('2000-01-01');
			state.current_offset = 0;
			state.total_count = 0;
			state.is_complete = false;
			state.started_at = new Date();
			state.completed_at = null;
			state = await this.syncStateRepo.save(state);
			this.logger.log(
				`${label} New run — syncing from ${state.sync_from_date.toISOString()}`,
			);
		} else {
			this.logger.log(
				`${label} Resuming run at offset ${state.current_offset}/${state.total_count}`,
			);
		}

		await this.fetchAndProcessBatch(state, filter, processItem);
	}

	// ─── Batch Processing ────────────────────────────────────────────────────────

	private async fetchAndProcessBatch(
		state: TokkoSyncState,
		filter: string,
		processItem: (item: any) => Promise<string>,
	): Promise<void> {
		const label = `[TokkoSync:${state.sync_type}]`;
		// Format date as ISO without milliseconds for the API
		const dateFrom = state.sync_from_date.toISOString().split('.')[0];

		const result = await this.tokkoHelperService.fetchFreePortalProperties(
			state.api_key,
			this.BATCH_SIZE,
			state.current_offset,
			dateFrom,
			undefined,
			filter,
		);

		if ('error' in result) {
			this.logger.error(`${label} API fetch failed: ${result.error} — ${result.details ?? ''}`);
			return;
		}

		const { objects, meta } = result;
		const totalCount: number = meta.total_count ?? objects.length;

		// Persist total_count once known (or if it changed)
		if (state.total_count !== totalCount) {
			state.total_count = totalCount;
		}

		this.logger.log(
			`${label} Fetched ${objects.length} items (offset=${state.current_offset}, total=${totalCount})`,
		);
		this.fileLogger.logBatchStart(state.current_offset, totalCount, dateFrom);

		const stats: any = { totalReceived: objects.length, created: 0, updated: 0, skipped: 0, failed: 0, deleted: 0 };

		// Process each item, logging errors without aborting the batch
		for (const item of objects) {
			this.fileLogger.logItemReceived(item);
			try {
				const outcome = await processItem(item);
				if (outcome in stats) stats[outcome]++;
				else stats.skipped++;
			} catch (err) {
				stats.failed++;
				const msg = err instanceof Error ? err.message : String(err);
				this.logger.error(
					`${label} Error processing item id=${item.id} pub=${item.publication_id}: ${msg}`,
				);
				this.fileLogger.logItemFailed(item, err);
			}
		}

		this.fileLogger.logBatchEnd(stats);
		this.logger.log(
			`${label} Batch done — ${Object.entries(stats).filter(([k]) => k !== 'totalReceived').map(([k, v]) => `${k}=${v}`).join(' ')}`,
		);

		// Advance offset
		const newOffset = state.current_offset + objects.length;
		const isDone = newOffset >= totalCount || objects.length === 0;

		state.current_offset = newOffset;
		if (isDone) {
			state.is_complete = true;
			state.completed_at = new Date();
			this.logger.log(`${label} Run complete. Processed ${newOffset}/${totalCount} items.`);
			this.fileLogger.info(`RUN_COMPLETE [${state.sync_type}] processed=${newOffset} total=${totalCount}`);
		}

		await this.syncStateRepo.save(state);
	}

	// ─── Deleted Property Processing ─────────────────────────────────────────────

	/**
	 * Marks a property as deleted in the local DB when it appears
	 * in the Tokko "filter=deleted" feed.
	 */
	private async processDeletedProperty(item: any): Promise<string> {
		if (!item || typeof item !== 'object') {
			this.fileLogger.warn('DELETE_SKIPPED reason="invalid payload"');
			return 'skipped';
		}

		const publicationId = item.publication_id != null ? String(item.publication_id) : null;
		if (!publicationId) {
			this.fileLogger.warn(`DELETE_SKIPPED tokko_id=${item.id ?? 'N/A'} reason="no publication_id"`);
			return 'skipped';
		}

		const existing = await this.propertyRepo.findOne({ where: { publication_id: publicationId } });

		if (!existing) {
			this.fileLogger.info(`DELETE_NOT_FOUND pub_id=${publicationId} — property not in local DB, nothing to delete`);
			return 'skipped';
		}

		if (existing.deleted) {
			this.fileLogger.info(`DELETE_ALREADY pub_id=${publicationId} property_id=${existing.id} — already marked deleted`);
			return 'skipped';
		}

		existing.deleted = true;
		await this.propertyRepo.save(existing);

		this.logger.log(`[TokkoSync:deleted] Marked property id=${existing.id} pub=${publicationId} as deleted`);
		this.fileLogger.info(`DELETE_DONE pub_id=${publicationId} property_id=${existing.id}`);
		return 'deleted';
	}

	// ─── Single Property Upsert ──────────────────────────────────────────────────

	private async processProperty(item: any): Promise<'created' | 'updated' | 'skipped'> {
		if (!item || typeof item !== 'object') {
			this.logger.warn('[TokkoSync] Skipping item: payload is null or invalid');
			this.fileLogger.warn('SKIPPED reason="invalid payload: item is null or not an object"');
			return 'skipped';
		}

		const publicationId = item.publication_id != null ? String(item.publication_id) : null;

		if (!publicationId) {
			this.logger.warn(
				`[TokkoSync] Item without publication_id skipped. tokko_id=${item.id ?? 'N/A'}`,
			);
			this.fileLogger.logItemSkipped('no publication_id', item);
			return 'skipped';
		}

		const seller = item.seller;
		if (!seller || typeof seller !== 'object') {
			this.logger.warn(
				`[TokkoSync] Skipping pub_id=${publicationId}: missing seller data`,
			);
			this.fileLogger.warn(
				`SKIPPED pub_id=${publicationId ?? 'N/A'} tokko_id=${item.id ?? 'N/A'} reason="missing seller data"`,
			);
			return 'skipped';
		}

		if (seller.company_id == null) {
			this.logger.warn(
				`[TokkoSync] Skipping pub_id=${publicationId}: seller without company_id`,
			);
			this.fileLogger.warn(
				`SKIPPED pub_id=${publicationId ?? 'N/A'} tokko_id=${item.id ?? 'N/A'} reason="seller without company_id"`,
			);
			return 'skipped';
		}

		this.fileLogger.info(
			`STEP seller_resolution pub_id=${publicationId} company_id=${seller.company_id ?? 'N/A'} branch_id=${seller.branch_id ?? 'N/A'}`,
		);
		let orgId: number;
		let branchId: number;
		let userId: number | undefined;
		try {
			({ orgId, branchId, userId } = await this.resolveSellerOrgBranch(seller));
			this.fileLogger.info(
				`STEP seller_resolved pub_id=${publicationId} org_id=${orgId} branch_id=${branchId} user_id=${userId ?? 'N/A'}`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.fileLogger.error(`STEP seller_resolution_failed pub_id=${publicationId} reason="${msg}"`, err);
			throw err;
		}

		this.fileLogger.info(`STEP original_property pub_id=${publicationId} data=${JSON.stringify(item)}`);
		this.fileLogger.info(`STEP mapping pub_id=${publicationId}`);

		let mapped: any;
		try {
			mapped = await this.tokkoHelperService.mapFreePortalPropertyToMetropropFormat(
				item,
				orgId,
				branchId,
				userId,
			);
			this.fileLogger.info(`STEP mapping_done pub_id=${publicationId} ref=${mapped.reference_code}`);
			this.fileLogger.info(`STEP mapped_property pub_id=${publicationId} data=${JSON.stringify(mapped)}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.fileLogger.error(`STEP mapping_failed pub_id=${publicationId} reason="${msg}"`, err);
			throw err;
		}

		// Separate scalar fields from relational payload
		const { images: newImagesData, videos: _v, attached: _a, tags: _t, ...scalarFields } =
			mapped as any;

		this.fileLogger.info(`STEP db_lookup pub_id=${publicationId}`);
		let existing: any;
		try {
			// necesito que vengan las imagenes tambien para comparar y decidir si hago update o no, porque si solo comparo los campos escalares, cualquier cambio en las imagenes no se reflejaria porque el scalarFields no cambia
			existing = await this.propertyRepo.findOne({ where: { publication_id: publicationId }, relations: ['images'] });
			this.fileLogger.info(
				`STEP db_lookup_done pub_id=${publicationId} existing=${existing ? `id=${existing.id}` : 'null'}`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.fileLogger.error(`STEP db_lookup_failed pub_id=${publicationId} reason="${msg}"`, err);
			throw err;
		}

		if (existing) {
			this.fileLogger.info(`STEP db_update pub_id=${publicationId} property_id=${existing.id}`);
			// log existing publication complete
			this.fileLogger.info(`STEP existing_property pub_id=${publicationId} data=${JSON.stringify(existing)}`);
			Object.assign(existing, scalarFields);
			let saved: any;
			try {
				// Extraer datos base y relaciones
				const { tags, images, videos, multimedia360, attached, ...propertyData } = mapped as any;
				const { warnings } = await this.propertyWriteService.updatePropertyCore(
					existing,
					propertyData,
					{ tags, images, videos, multimedia360, attached },
				);

				if (warnings && warnings.length > 0) {
					warnings.forEach((warning: string) => {
						this.fileLogger.warn(`UPDATE_WARNING pub_id=${publicationId} property_id=${saved.id} warning="${warning}"`);
					});
				}

				saved = await this.propertyRepo.findOne({ where: { id: existing.id } });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(`STEP db_update_failed pub_id=${publicationId} reason="${msg}"`, err);
				throw err;
			}
			this.logger.debug(`[TokkoSync] Updated property id=${saved.id} pub=${publicationId}`);
			this.fileLogger.logItemUpdated(publicationId, saved.id!);

			return 'updated';
		} else {
			this.fileLogger.info(`STEP db_create pub_id=${publicationId}`);
			try {
				// Crear la propiedad base y sincronizar tags, videos, multimedia360, images y attached
				const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
					{ ...scalarFields, deleted: false },
					{
						tags: mapped.tags,
						videos: mapped.videos,
						multimedia360: mapped.multimedia360,
						images: mapped.images,
						attached: mapped.attached,
					}
				);

				this.logger.debug(`[TokkoSync] Created property id=${savedProperty.id} pub=${publicationId}`);
				this.fileLogger.logItemCreated(publicationId, savedProperty.id!, orgId, branchId);
				if (warnings && warnings.length > 0) {
					warnings.forEach((warning: string) => {
						this.fileLogger.warn(`CREATE_WARNING pub_id=${publicationId} property_id=${savedProperty.id} warning="${warning}"`);
					});
				}

			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(`STEP db_create_failed pub_id=${publicationId} reason="${msg}"`, err);
				throw err;
			}

			return 'created';
		}
	}

	// ─── Org / Branch Resolution ─────────────────────────────────────────────────

	private async resolveSellerOrgBranch(
		seller: any,
	): Promise<{ orgId: number; branchId: number; userId?: number }> {
		const companyId = seller.company_id != null ? String(seller.company_id) : null;
		const branchExtRef = seller.branch_id != null ? String(seller.branch_id) : null;

		if (!companyId) {
			throw new Error('seller.company_id is required to resolve organization');
		}

		this.fileLogger.info(`STEP org_lookup ext_ref=${companyId}`);
		// Find org by external_reference

		// Validar si existe un usuario con el email antes de crear la organización
		const existingUser = await this.usersService.findByEmail(seller.email);
		let org = await this.organizationRepo.findOne({
			where: { external_reference: companyId, deleted: false } as any,
			relations: ['admin_user'],
		});

		if (!org) {
			// ya existe un usuario con ese mail pero no asociado a la companyId que nos llega de tokko
			if (existingUser) {
				throw new Error(
					`No se puede crear la organización con companyId ${companyId} porque ya existe un usuario registrado con el email ${seller.email} asociado a otra organización. Por favor, utilice un email diferente o contacte al soporte.`
				);
			}

			this.fileLogger.info(`STEP org_create ext_ref=${companyId} company="${seller.company_name ?? 'N/A'}"`);
			try {
				org = await this.createOrgFromSeller(seller);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(`STEP org_create_failed ext_ref=${companyId} reason="${msg}"`, err);
				throw err;
			}
			if (!org) {
				throw new Error('Failed to create organization');
			}
			this.logger.log(
				`[TokkoSync] Created new organization id=${org.id} (ext_ref=${companyId})`,
			);
			this.fileLogger.logOrgCreated(companyId, org.id!, seller.email ?? '');
		} else {
			this.fileLogger.info(`STEP org_found ext_ref=${companyId} org_id=${org.id}`);
		}

		if (!org) {
			throw new Error('Organization is null after creation/fetch');
		}

		// Find branch by external_reference within this org
		let branch: any = null;
		if (branchExtRef) {
			this.fileLogger.info(`STEP branch_lookup ext_ref=${branchExtRef} org_id=${org.id}`);
			branch = await this.branchesService.findByExternalReference(org.id!, branchExtRef);
		}

		if (!branch) {
			this.fileLogger.info(`STEP branch_create ext_ref=${branchExtRef ?? 'N/A'} org_id=${org.id}`);
			try {
				branch = await this.branchesService.create({
					branch_name: seller.branch_name ?? seller.company_name ?? 'Branch',
					email: seller.email ?? org.email,
					phone: seller.phone ?? '',
					address: seller.address ?? '',
					external_reference: branchExtRef ?? undefined,
					organizationId: org.id!,
					// Creation-only fallback: if branch logo is missing, reuse company logo.
					branch_logo: seller.branch_logo ?? seller.company_logo ?? undefined,
				} as any);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(`STEP branch_create_failed ext_ref=${branchExtRef ?? 'N/A'} org_id=${org.id} reason="${msg}"`, err);
				throw err;
			}
			this.logger.log(
				`[TokkoSync] Created new branch id=${branch.id} (ext_ref=${branchExtRef})`,
			);
			this.fileLogger.logBranchCreated(branchExtRef, branch.id!, org.id!);

			// Asociar el usuario admin con el branch recién creado en users_branches
			const adminUserId: number | undefined = (org as any).admin_user?.id;
			if (adminUserId) {
				await this.usersService.addBranchToUser(adminUserId, branch.id);
			}
		} else {
			this.fileLogger.info(`STEP branch_found ext_ref=${branchExtRef} branch_id=${branch.id} org_id=${org.id}`);
		}

		let adminUserId: number | undefined = (org as any).admin_user?.id;
		
		// Si el email del seller es diferente al del admin_user de la organización, y existe un usuario con ese email, 
		// asociar ese usuario a la organización y branch correspondientes. Si no existe un usuario con ese email, 
		// crear uno nuevo asociado a la organización y branch. Esto permite que cada vendedor tenga su propio usuario para acceder a Metroprop, 
		// en lugar de compartir el usuario admin de la organización.
		if(seller.email !== org.admin_user?.email) {
			console.log('EL EMAIL ASIGNADo AL USUARIO ADMIN DE LA ORG ES DIFERENTE AL EMAIL DEL VENDEDOR. SE INTENTARÁ ASOCIAR O CREAR UN USUARIO PARA EL VENDEDOR. seller_email=' + seller.email + ' admin_email=' + org.admin_user?.email);
			this.fileLogger.info(`EL EMAIL ASIGNADo AL USUARIO ADMIN DE LA ORG ES DIFERENTE AL EMAIL DEL VENDEDOR. SE INTENTARÁ ASOCIAR O CREAR UN USUARIO PARA EL VENDEDOR. seller_email=${seller.email} admin_email=${org.admin_user?.email}`);
			if (existingUser) {
				this.fileLogger.info(`SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE ASOCIARÁ A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. user_id=${existingUser.id} email=${existingUser.email}`);
				console.log(`SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE ASOCIARÁ A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. user_id=${existingUser.id} email=${existingUser.email}`);
				adminUserId = existingUser.id;
			} else {
				this.fileLogger.info(`NO SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE CREARÁ UN NUEVO USUARIO ASOCIADO A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. seller_email=${seller.email}`);
				 console.log(`NO SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE CREARÁ UN NUEVO USUARIO ASOCIADO A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. seller_email=${seller.email}`);
				try {
					const newUser = await this.usersService.create({
						name: seller.company_name ?? 'Admin',
						email: seller.email ?? '',
						password: PASSWORD_DEFAULT,
						role_id: UserRole.USER_ROL_SELLER,
						organizationId: org.id,
					} as any);
					adminUserId = newUser.id;
					this.fileLogger.info(`USUARIO CREADO PARA EL VENDEDOR. user_id=${newUser.id} email=${newUser.email}`);
					 console.log(`USUARIO CREADO PARA EL VENDEDOR. user_id=${newUser.id} email=${newUser.email}`);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					this.fileLogger.error(`ERROR AL CREAR USUARIO PARA EL VENDEDOR. seller_email=${seller.email} reason="${msg}"`, err);
					 console.error(`ERROR AL CREAR USUARIO PARA EL VENDEDOR. seller_email=${seller.email} reason="${msg}"`, err);
					this.fileLogger.info(`SE USARÁ EL USUARIO ADMIN EXISTENTE PARA EL VENDEDOR. user_id=${org.admin_user?.id} email=${org.admin_user?.email}`);
					 console.log(`SE USARÁ EL USUARIO ADMIN EXISTENTE PARA EL VENDEDOR. user_id=${org.admin_user?.id} email=${org.admin_user?.email}`);
					adminUserId = org.admin_user?.id;
				}
			}
		}

		return { orgId: org.id!, branchId: branch.id!, userId: adminUserId };
	}

	private async createOrgFromSeller(seller: any): Promise<any> {
		const partnerId = this.tokkoPartnerId;
		if (!partnerId) {
			throw new Error('Tokko partner not loaded');
		}

		const savedOrg = await this.organizationsService.create({
			company_name: seller.company_name ?? 'Unknown',
			email: seller.email ?? '',
			address: seller.address ?? '',
			phone: seller.phone ?? '',
			alternative_phone: seller.alternative_phone ?? '',
			contact_time: seller.contact_time ?? '',
			geo_lat: seller.geo_lat ?? undefined,
			geo_long: seller.geo_long ?? undefined,
			full_location: seller.full_location ?? undefined,
			external_reference: seller.company_id != null ? String(seller.company_id) : undefined,
			company_logo: seller.company_logo ?? undefined,
			status: true,
			deleted: false,
			source_partner_id: partnerId,
		} as any);

		// Create admin user with hashed "demo" password
		try {
			const adminUser = await this.usersService.create({
				name: seller.company_name ?? 'Admin',
				email: seller.email ?? '',
				password: PASSWORD_DEFAULT,
				role_id: UserRole.USER_ROL_ADMIN,
				organizationId: savedOrg.id,
			} as any);

			await this.organizationRepo.update(savedOrg.id!, {
				admin_user: { id: adminUser.id } as any,
			});
			savedOrg.admin_user = adminUser as any;
		} catch (err) {
			// If the email already exists, log and continue — org is still valid
			this.logger.warn(
				`[TokkoSync] Could not create admin user for org ${savedOrg.id}: ${(err as Error).message}`,
			);
			this.fileLogger.warn(
				`ADMIN_USER_FAILED org_id=${savedOrg.id} email=${seller.email ?? 'N/A'} reason="${(err as Error).message}"`,
			);
		}

		return savedOrg;
	}

	private async resolveTokkoPartnerId(): Promise<number | null> {
		if (this.tokkoPartnerId) {
			return this.tokkoPartnerId;
		}

		const tokkoPartner = await this.partnersService.findByName('tokko');

		if (!tokkoPartner) {
			this.logger.warn('[TokkoSync] Partner "tokko" not found; skipping sync run');
			this.fileLogger.warn('TOKKO_PARTNER_NOT_FOUND name="tokko"');
			return null;
		}

		this.tokkoPartnerId = tokkoPartner.id;
		return this.tokkoPartnerId;
	}

	// ─── Image Smart-Sync ────────────────────────────────────────────────────────

	/**
	 * Synchronises images for a property:
	 *  - Deletes images whose original_image URL no longer appears in the feed
	 *  - Creates new images for URLs not yet stored
	 *  - Leaves unchanged images untouched (no re-upload)
	 */
	private async syncPropertyImages(
		propertyId: number,
		newPhotos: Array<{
			url: string;
			original_image: string;
			description?: string;
			is_blueprint?: boolean;
			order_position?: number;
		}>,
	): Promise<void> {
		const existingImages = await this.propertyImageRepo.find({
			where: { property: { id: propertyId } } as any,
		});

		const existingOriginals = new Set<string>(
			existingImages.map(img => img.original_image).filter(Boolean) as string[],
		);
		const newOriginals = new Set<string>(
			newPhotos.map(p => p.original_image).filter(Boolean),
		);

		// Remove images no longer in feed
		const toDelete = existingImages.filter(
			img => img.original_image && !newOriginals.has(img.original_image),
		);
		if (toDelete.length) {
			await this.propertyImageRepo.remove(toDelete);
			this.logger.debug(
				`[TokkoSync] Removed ${toDelete.length} stale images for property ${propertyId}`,
			);
		}

		// Add new images
		const toCreate = newPhotos.filter(p => !existingOriginals.has(p.original_image));
		for (const photoData of toCreate) {
			const img = this.propertyImageRepo.create({
				url: photoData.url,
				original_image: photoData.original_image,
				description: photoData.description,
				is_blueprint: photoData.is_blueprint ?? false,
				order_position: photoData.order_position ?? 0,
				upload_status: MediaUploadStatus.PENDING,
				retry_count: 0,
				property: { id: propertyId } as any,
			});
			await this.propertyImageRepo.save(img);
		}

		const unchanged = existingImages.length - toDelete.length;
		this.fileLogger.logImagesSync(propertyId, toCreate.length, toDelete.length, unchanged);

		if (toCreate.length > 0) {
			this.logger.debug(
				`[TokkoSync] Queued ${toCreate.length} new images for property ${propertyId}`,
			);
		}
	}
}
