import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { TokkoSyncState } from './entities/tokko-sync-state.entity';
import { Property } from '../../properties/entities/property.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { OrganizationsService } from '../../organizations/organizations.service';
import { PartnersService } from '../../partners/partners.service';

import {
	TokkoFeedbackObject,
	TokkoHelperService,
	notifyTokkoPublicationFeedback,
} from '../../../common/helpers/tokko-helper';
import { BranchesService } from '../../branches/branches.service';
import { UsersService } from '../../users/users.service';
import { PropertyStatus, UserRole } from '../../../common/enums';
import { TokkoSyncLoggerService } from './tokko-sync-logger.service';
import { PASSWORD_DEFAULT, TOKKO_PARTNER_NAME } from '@/common/constants';
import { PropertyWriteService } from '@/modules/properties/property-write.service';
import { EmailService } from '@/common/email/email.service';


export interface TokkoFullCompareOptions {
	/** Falls back to TOKKO_METROPROP_API_KEY when omitted */
	apiKey?: string;
	/** Restricts the run to a single organization (Tokko company_id) */
	externalReference?: string;
	/** When false (default) nothing is written: the feed is only compared against the DB */
	force?: boolean;
	/** Page size for the Tokko feed. Capped at TOKKO_FEED_MAX_PAGE_SIZE */
	pageSize?: number;
}

export interface TokkoFullCompareOrgResult {
	organization_id: number;
	company_name: string;
	external_reference: string;
	/** total_count reported by the Tokko feed for this organization */
	tokko_total: number;
	/** items actually retrieved from the feed across all pages */
	fetched: number;
	pages: number;
	/** feed items that carry no publication_id, so they cannot be matched */
	feed_without_publication_id: number;
	/** properties stored locally that came from Tokko (publication_id present) */
	local_total: number;
	/** subset of local_total that is currently published (DISPONIBLE) */
	local_available: number;
	/**
	 * Feed publication_ids that we do not have stored — the ones still to obtain.
	 * Measured after the run, so in force mode it only counts what failed to import.
	 */
	missing: number;
	missing_publication_ids: string[];
	missing_publication_ids_truncated: boolean;
	/**
	 * Stored published properties whose publication_id is no longer in the feed.
	 * Measured after the run, so in force mode these were already depublished and
	 * the count shows up under `depublished` instead.
	 */
	not_in_feed: number;
	not_in_feed_publication_ids: string[];
	not_in_feed_publication_ids_truncated: boolean;
	/** Write stats. Always zero in dry-run mode */
	created: number;
	updated: number;
	skipped: number;
	failed: number;
	depublished: number;
	error?: string;
}

export interface TokkoFullCompareResult {
	message: string;
	dry_run: boolean;
	page_size: number;
	organizations_scanned: number;
	totals: {
		tokko_total: number;
		fetched: number;
		local_total: number;
		local_available: number;
		missing: number;
		not_in_feed: number;
		created: number;
		updated: number;
		skipped: number;
		failed: number;
		depublished: number;
		organizations_with_errors: number;
	};
	results: TokkoFullCompareOrgResult[];
}

type TokkoFeedbackSource = 'cron' | 'sync-one' | 'sync-organization';

interface TokkoFeedbackContext {
	source: TokkoFeedbackSource;
	apiKey: string;
	enabled: boolean;
	dedupe: Set<string>;
}

interface TokkoBatchFailureResult {
	ok: false;
	reason: 'API_FETCH_FAILED' | 'UNEXPECTED_BATCH_EXCEPTION';
	details?: string;
	dateFromUsed: string;
	offset: number;
	totalCount: number;
}

type TokkoBatchResult =
	| { ok: true }
	| TokkoBatchFailureResult;

@Injectable()
export class TokkoSyncService implements OnModuleInit {
	private readonly logger = new Logger(TokkoSyncService.name);
	private readonly BATCH_SIZE = 100;
	/** Hard limit imposed by the Tokko freeportals endpoint */
	private readonly TOKKO_FEED_MAX_PAGE_SIZE = 1000;
	/** Guard against an endless paging loop if meta.total_count keeps growing */
	private readonly TOKKO_FEED_MAX_PAGES = 100;
	/** publication_id lists are for eyeballing, not for exhaustive reporting */
	private readonly COMPARE_IDS_IN_RESPONSE = 100;
	private tokkoPartnerId: number | null = null;

	constructor(
		@InjectRepository(TokkoSyncState)
		private readonly syncStateRepo: Repository<TokkoSyncState>,
		@InjectRepository(Property)
		private readonly propertyRepo: Repository<Property>,
		@InjectRepository(Organization)
		private readonly organizationRepo: Repository<Organization>,
		private readonly tokkoHelperService: TokkoHelperService,
		private readonly branchesService: BranchesService,
		private readonly organizationsService: OrganizationsService,
		private readonly partnersService: PartnersService,
		private readonly usersService: UsersService,
		private readonly configService: ConfigService,
		private readonly fileLogger: TokkoSyncLoggerService,
		private readonly propertyWriteService: PropertyWriteService,
		private readonly emailService: EmailService,  
		
		
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
		this.logger.log(`[TokkoSync-ONE] syncSingleProperty publication_id=${publicationId}`);
		this.fileLogger.info(`TokkoSync-ONE publication_id=${publicationId}`);

		const apiKey = this.configService.get<string>('TOKKO_METROPROP_API_KEY');
		if (!apiKey) {
			return { outcome: 'skipped', message: 'TOKKO_METROPROP_API_KEY not configured' };
		}

		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return { outcome: 'skipped', message: 'Partner "tokko" not configured' };
		}

		this.logger.log(`[TokkoSync-ONE] syncSingleProperty publication_id=${publicationId}`);
		this.fileLogger.info(`TokkoSync-ONE publication_id=${publicationId}`);
		const feedbackContext = this.createFeedbackContext('sync-one', apiKey);

		const result = await this.tokkoHelperService.fetchFreePortalPropertyById(apiKey, publicationId);

		if ('error' in result) {
			if (result.notFound) {
				this.fileLogger.warn(
					`TokkoSync-ONE_NOT_FOUND publication_id=${publicationId}` +
					(result.details ? ` details=${result.details}` : ''),
				);
				await this.sendCriticalTokkoFeedback(feedbackContext, {
					publicationId,
					reasonCode: 'PUBLICATION_NOT_FOUND',
					message: `No se encontro el aviso con publication_id ${publicationId} en Tokko.`,
				});
				return { outcome: 'not_found', message: result.error };
			}
			const msg = result.details ? `${result.error}: ${result.details}` : result.error;
			this.logger.error(`[TokkoSync-ONE] syncSingleProperty HTTP error: ${msg}`);
			this.fileLogger.error(`TokkoSync-ONE_ERROR publication_id=${publicationId} ${msg}`);
			return { outcome: 'skipped', message: msg };
		}

		const { item } = result;
		this.fileLogger.logItemReceived(item);
		try {
			const outcome = await this.processProperty(item, feedbackContext);
			const msg = `publication_id=${publicationId} outcome=${outcome}`;
			this.logger.log(`[TokkoSync-ONE] syncSingleProperty done — ${msg}`);
			this.fileLogger.info(`TokkoSync-ONE_DONE ${msg}`);
			return { outcome, message: `Property ${outcome} successfully` };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await this.reportCriticalFeedbackFromError(
				feedbackContext,
				publicationId,
				err,
				item?.id != null ? String(item.id) : undefined,
			);
			this.logger.error(`[TokkoSync-ONE] syncSingleProperty failed — ${msg}`);
			this.fileLogger.logItemFailed(item, err);
			return { outcome: 'skipped', message: msg };
		}
	}

	async syncOrganization(
		apiKey: string,
		tokkoOrganizationId: string,
		limit: number = 2000,
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
		depublished: number;
	}> {
		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return {
				message: 'Partner "tokko" not configured. Sync skipped.',
				processed: 0, total: 0, pending: 0,
				created: 0, updated: 0, skipped: 0, failed: 0, depublished: 0,
			};
		}

		this.logger.log(`[TokkoSync] syncOrganization org=${tokkoOrganizationId} limit=${limit} offset=${offset}`);
		this.fileLogger.orgInfo(tokkoOrganizationId, `ORG_SYNC_START org=${tokkoOrganizationId} limit=${limit} offset=${offset}`);

		const result = await this.tokkoHelperService.fetchFreePortalProperties(
			apiKey,
			limit,
			offset,
			null,
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
		const stats = { created: 0, updated: 0, skipped: 0, failed: 0, depublished: 0 };
		const feedbackContext = this.createFeedbackContext('sync-organization', apiKey);

		// Track all publication_ids present in this feed response
		const feedPublicationIds = new Set<string>(
			objects
				.map((item: any) => item?.publication_id != null ? String(item.publication_id) : null)
				.filter((id): id is string => id !== null),
		);

		for (const item of objects) {
			const pubId = item?.publication_id != null ? String(item.publication_id) : 'N/A';
			try {
				const outcome = await this.processProperty(item, feedbackContext);
				if (outcome === 'created') stats.created++;
				else if (outcome === 'updated') stats.updated++;
				else stats.skipped++;
				this.fileLogger.orgInfo(tokkoOrganizationId, `ITEM pub_id=${pubId} outcome=${outcome}`);
			} catch (err) {
				stats.failed++;
				const msg = err instanceof Error ? err.message : String(err);
				await this.reportCriticalFeedbackFromError(
					feedbackContext,
					item?.publication_id != null ? String(item.publication_id) : null,
					err,
					item?.id != null ? String(item.id) : undefined,
				);
				this.logger.error(
					`[TokkoSync] syncOrganization error processing item id=${item.id}: ${msg}`,
				);
				this.fileLogger.orgError(tokkoOrganizationId, `ITEM_FAILED pub_id=${pubId} error="${msg}"`, err);
			}
		}

		const processed = objects.length;
		const pending = Math.max(0, totalCount - offset - processed);

		// Depublish properties that belong to this org, are currently DISPONIBLE,
		// came from Tokko (have a publication_id) but are no longer in the feed.
		const org = await this.organizationRepo.findOne({
			where: { external_reference: tokkoOrganizationId, deleted: false } as any,
		});

		if (org) {
			stats.depublished = await this.depublishPropertiesNotInFeed(
				org.id!,
				tokkoOrganizationId,
				feedPublicationIds,
			);
		}

		const message = pending > 0
			? `${processed} de ${totalCount} procesadas, ${pending} pendientes`
			: `${processed} de ${totalCount} procesadas`;

		this.logger.log(`[TokkoSync] syncOrganization done — ${message}`);
		this.fileLogger.orgInfo(
			tokkoOrganizationId,
			`ORG_SYNC_DONE ${message} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} failed=${stats.failed} depublished=${stats.depublished}`,
		);
		return { message, processed, total: totalCount, pending, ...stats };
	}

	/**
	 * Walks every active organization that came from Tokko (external_reference set,
	 * status = true, deleted = false), pulls its whole feed page by page and compares
	 * it against what we have stored, so we can see how many properties are still
	 * missing per organization.
	 *
	 * Dry-run by default: nothing is written unless `force` is true.
	 */
	async fullCompareOrganizations(
		options: TokkoFullCompareOptions = {},
	): Promise<TokkoFullCompareResult> {
		const force = options.force === true;
		const pageSize = Math.min(
			Math.max(1, options.pageSize ?? this.TOKKO_FEED_MAX_PAGE_SIZE),
			this.TOKKO_FEED_MAX_PAGE_SIZE,
		);
		const resolvedApiKey =
			options.apiKey ?? this.configService.get<string>('TOKKO_METROPROP_API_KEY');

		const emptyResult: TokkoFullCompareResult = {
			message: '',
			dry_run: !force,
			page_size: pageSize,
			organizations_scanned: 0,
			totals: {
				tokko_total: 0, fetched: 0,
				local_total: 0, local_available: 0,
				missing: 0, not_in_feed: 0,
				created: 0, updated: 0, skipped: 0, failed: 0, depublished: 0,
				organizations_with_errors: 0,
			},
			results: [],
		};

		if (!resolvedApiKey) {
			return { ...emptyResult, message: 'TOKKO_METROPROP_API_KEY not configured' };
		}

		const partnerId = await this.resolveTokkoPartnerId();
		if (!partnerId) {
			return { ...emptyResult, message: 'Partner "tokko" not configured. Compare skipped.' };
		}

		const requestedRef = options.externalReference?.trim();
		const organizations = await this.organizationRepo.find({
			where: {
				external_reference: requestedRef ? requestedRef : Not(IsNull()),
				source_partner_id: partnerId,
				status: true,
				deleted: false,
			} as any,
			order: { id: 'ASC' } as any,
		});

		const targets = organizations.filter((org) => !!org.external_reference?.trim());

		if (requestedRef && targets.length === 0) {
			return {
				...emptyResult,
				message:
					`No hay organización activa de Tokko con external_reference=${requestedRef} ` +
					`(se requiere status = true y deleted = false)`,
			};
		}

		const mode = force ? 'FORCE' : 'DRY-RUN';
		this.logger.log(
			`[TokkoSync-COMPARE] ${mode} over ${targets.length} organizations (page_size=${pageSize})`,
		);
		this.fileLogger.info(
			`FULL_COMPARE_START mode=${mode} organizations=${targets.length} page_size=${pageSize}` +
			(requestedRef ? ` ext_ref=${requestedRef}` : ''),
		);

		const results: TokkoFullCompareOrgResult[] = [];
		const totals = { ...emptyResult.totals };

		for (const org of targets) {
			const externalReference = org.external_reference!.trim();

			try {
				const entry = await this.compareOrganization(
					resolvedApiKey,
					org,
					externalReference,
					pageSize,
					force,
				);

				results.push(entry);
				totals.tokko_total += entry.tokko_total;
				totals.fetched += entry.fetched;
				totals.local_total += entry.local_total;
				totals.local_available += entry.local_available;
				totals.missing += entry.missing;
				totals.not_in_feed += entry.not_in_feed;
				totals.created += entry.created;
				totals.updated += entry.updated;
				totals.skipped += entry.skipped;
				totals.failed += entry.failed;
				totals.depublished += entry.depublished;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				totals.organizations_with_errors++;
				results.push({
					...this.emptyCompareOrgResult(org.id!, org.company_name, externalReference),
					error: msg,
				});
				this.logger.error(
					`[TokkoSync-COMPARE] org_id=${org.id} ext_ref=${externalReference} failed: ${msg}`,
				);
				this.fileLogger.orgError(
					externalReference,
					`FULL_COMPARE_ORG_FAILED org_id=${org.id} error="${msg}"`,
					err,
				);
			}
		}

		const message =
			`[${mode}] ${targets.length} organizaciones analizadas, ${totals.tokko_total} propiedades en Tokko, ` +
			`${totals.local_total} guardadas, ${totals.missing} faltantes, ${totals.not_in_feed} fuera del feed` +
			(totals.organizations_with_errors > 0
				? `, ${totals.organizations_with_errors} organizaciones con errores`
				: '');

		this.logger.log(`[TokkoSync-COMPARE] done — ${message}`);
		this.fileLogger.info(`FULL_COMPARE_DONE ${message}`);

		return {
			message,
			dry_run: !force,
			page_size: pageSize,
			organizations_scanned: targets.length,
			totals,
			results,
		};
	}

	/**
	 * Pulls the whole feed for one organization and diffs it against the DB.
	 * Only persists (upsert + depublish) when `force` is true.
	 */
	private async compareOrganization(
		apiKey: string,
		org: Organization,
		externalReference: string,
		pageSize: number,
		force: boolean,
	): Promise<TokkoFullCompareOrgResult> {
		const entry = this.emptyCompareOrgResult(org.id!, org.company_name, externalReference);
		const feedPublicationIds = new Set<string>();

		let offset = 0;
		let totalCount = 0;

		for (let page = 0; page < this.TOKKO_FEED_MAX_PAGES; page++) {
			const result = await this.tokkoHelperService.fetchFreePortalProperties(
				apiKey,
				pageSize,
				offset,
				null,
				externalReference,
			);

			if ('error' in result) {
				const msg = result.details ? `${result.error}: ${result.details}` : result.error;
				this.fileLogger.orgError(externalReference, `FULL_COMPARE_API_ERROR offset=${offset} ${msg}`);
				throw new Error(msg);
			}

			const { objects, meta } = result;
			entry.pages++;
			entry.fetched += objects.length;
			totalCount = meta?.total_count ?? entry.fetched;

			for (const item of objects) {
				const pubId = item?.publication_id != null ? String(item.publication_id) : null;
				if (pubId) {
					feedPublicationIds.add(pubId);
				} else {
					entry.feed_without_publication_id++;
				}

				if (!force) continue;

				try {
					const outcome = await this.processProperty(item);
					if (outcome === 'created') entry.created++;
					else if (outcome === 'updated') entry.updated++;
					else entry.skipped++;
				} catch (err) {
					entry.failed++;
					const msg = err instanceof Error ? err.message : String(err);
					this.fileLogger.orgError(
						externalReference,
						`FULL_COMPARE_ITEM_FAILED pub_id=${pubId ?? 'N/A'} error="${msg}"`,
						err,
					);
				}
			}

			this.fileLogger.orgInfo(
				externalReference,
				`FULL_COMPARE_PAGE offset=${offset} received=${objects.length} total_count=${totalCount}`,
			);

			offset += objects.length;

			// `next` is null on the last page; the offset check covers feeds that omit it.
			const hasMore = objects.length > 0 && offset < totalCount;
			if (!hasMore) break;

			if (page === this.TOKKO_FEED_MAX_PAGES - 1) {
				this.logger.warn(
					`[TokkoSync-COMPARE] ext_ref=${externalReference} hit the ${this.TOKKO_FEED_MAX_PAGES} page cap ` +
					`at offset=${offset}/${totalCount}`,
				);
				this.fileLogger.orgInfo(
					externalReference,
					`FULL_COMPARE_PAGE_CAP_WARN offset=${offset} total_count=${totalCount}`,
				);
			}
		}

		entry.tokko_total = totalCount;

		// Depublishing needs the publication_ids of every page, so it runs once the
		// whole feed has been walked — otherwise each page would depublish the rest.
		if (force) {
			entry.depublished = await this.depublishPropertiesNotInFeed(
				org.id!,
				externalReference,
				feedPublicationIds,
			);
		}

		const feedIds = [...feedPublicationIds];
		const storedIds = await this.findStoredPublicationIds(feedIds);
		const missingIds = feedIds.filter((id) => !storedIds.has(id));
		const notInFeedIds = await this.findPublishedPublicationIdsNotInFeed(org.id!, feedPublicationIds);

		const counts = await this.countLocalTokkoProperties(org.id!);
		entry.local_total = counts.local_total;
		entry.local_available = counts.local_available;

		entry.missing = missingIds.length;
		entry.missing_publication_ids = missingIds.slice(0, this.COMPARE_IDS_IN_RESPONSE);
		entry.missing_publication_ids_truncated = missingIds.length > this.COMPARE_IDS_IN_RESPONSE;

		entry.not_in_feed = notInFeedIds.length;
		entry.not_in_feed_publication_ids = notInFeedIds.slice(0, this.COMPARE_IDS_IN_RESPONSE);
		entry.not_in_feed_publication_ids_truncated = notInFeedIds.length > this.COMPARE_IDS_IN_RESPONSE;

		this.fileLogger.orgInfo(
			externalReference,
			`FULL_COMPARE_ORG org_id=${org.id} ext_ref=${externalReference} pages=${entry.pages} ` +
			`tokko_total=${entry.tokko_total} fetched=${entry.fetched} local_total=${entry.local_total} ` +
			`local_available=${entry.local_available} missing=${entry.missing} not_in_feed=${entry.not_in_feed} ` +
			`created=${entry.created} updated=${entry.updated} skipped=${entry.skipped} failed=${entry.failed} ` +
			`depublished=${entry.depublished}`,
		);

		return entry;
	}

	private emptyCompareOrgResult(
		organizationId: number,
		companyName: string,
		externalReference: string,
	): TokkoFullCompareOrgResult {
		return {
			organization_id: organizationId,
			company_name: companyName,
			external_reference: externalReference,
			tokko_total: 0,
			fetched: 0,
			pages: 0,
			feed_without_publication_id: 0,
			local_total: 0,
			local_available: 0,
			missing: 0,
			missing_publication_ids: [],
			missing_publication_ids_truncated: false,
			not_in_feed: 0,
			not_in_feed_publication_ids: [],
			not_in_feed_publication_ids_truncated: false,
			created: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
			depublished: 0,
		};
	}

	/**
	 * Returns the subset of the given publication_ids that we already have stored.
	 * Queried in chunks to stay well below the driver's bind parameter limit.
	 */
	private async findStoredPublicationIds(publicationIds: string[]): Promise<Set<string>> {
		const found = new Set<string>();
		const CHUNK_SIZE = 500;

		for (let i = 0; i < publicationIds.length; i += CHUNK_SIZE) {
			const chunk = publicationIds.slice(i, i + CHUNK_SIZE);
			if (chunk.length === 0) continue;

			const rows = await this.propertyRepo
				.createQueryBuilder('p')
				.select('p.publication_id', 'publication_id')
				.where('p.publication_id IN (:...chunk)', { chunk })
				.andWhere('p.deleted = false')
				.getRawMany<{ publication_id: string }>();

			rows.forEach((row) => {
				if (row.publication_id != null) found.add(String(row.publication_id));
			});
		}

		return found;
	}

	/**
	 * publication_ids of the organization's published properties that no longer
	 * appear in the feed — i.e. the ones a forced run would depublish.
	 */
	private async findPublishedPublicationIdsNotInFeed(
		organizationId: number,
		feedPublicationIds: Set<string>,
	): Promise<string[]> {
		const query = this.propertyRepo
			.createQueryBuilder('p')
			.select('p.publication_id', 'publication_id')
			.where('p.organization_id = :organizationId', { organizationId })
			.andWhere('p.status = :status', { status: PropertyStatus.DISPONIBLE })
			.andWhere('p.deleted = false')
			.andWhere('p.publication_id IS NOT NULL');

		const rows = await query.getRawMany<{ publication_id: string }>();

		return rows
			.map((row) => String(row.publication_id))
			.filter((id) => !feedPublicationIds.has(id));
	}

	/**
	 * Marks the organization's published Tokko properties that are absent from the
	 * feed as NO_DISPONIBLE. Expects the publication_ids of the *entire* feed.
	 */
	private async depublishPropertiesNotInFeed(
		organizationId: number,
		externalReference: string,
		feedPublicationIds: Set<string>,
	): Promise<number> {
		const feedIds = [...feedPublicationIds];
		if (feedIds.length === 0) return 0;

		const updateResult = await this.propertyRepo
			.createQueryBuilder()
			.update()
			.set({ status: PropertyStatus.NO_DISPONIBLE })
			.where('organization_id = :orgId', { orgId: organizationId })
			.andWhere('status = :status', { status: PropertyStatus.DISPONIBLE })
			.andWhere('deleted = false')
			.andWhere('publication_id IS NOT NULL')
			.andWhere('publication_id NOT IN (:...feedIds)', { feedIds })
			.execute();

		const depublished = updateResult.affected ?? 0;

		if (depublished > 0) {
			this.logger.log(`[TokkoSync] Depublished ${depublished} properties not in feed (org_id=${organizationId})`);
			this.fileLogger.orgInfo(externalReference, `ORG_SYNC_DEPUBLISHED count=${depublished}`);
		}

		return depublished;
	}

	/**
	 * Counts the properties we have stored for an organization that originated in
	 * Tokko (publication_id present), both in total and only the published ones.
	 */
	private async countLocalTokkoProperties(
		organizationId: number,
	): Promise<{ local_total: number; local_available: number }> {
		const [local_total, local_available] = await Promise.all([
			this.propertyRepo.count({
				where: {
					organization_id: organizationId,
					deleted: false,
					publication_id: Not(IsNull()),
				} as any,
			}),
			this.propertyRepo.count({
				where: {
					organization_id: organizationId,
					deleted: false,
					status: PropertyStatus.DISPONIBLE,
					publication_id: Not(IsNull()),
				} as any,
			}),
		]);

		return { local_total, local_available };
	}

	// ─── Sync Orchestration ──────────────────────────────────────────────────────

	private async syncFreePortalFeed(apiKey: string): Promise<void> {
		const feedbackContext = this.createFeedbackContext('cron', apiKey);
		await this.runPaginatedSync(
			apiKey,
			'feed',
			'updated',
			(item) => this.processProperty(item, feedbackContext),
			feedbackContext,
		);
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
		feedbackContext?: TokkoFeedbackContext,
	): Promise<void> {
		const label = `[TokkoSync:${syncType}]`;
		this.logger.log(`${label} Starting sync cycle`);
		this.fileLogger.info(`${label} Starting sync cycle`);

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
				error_try: 0,
				is_complete: true,
			});
			state = await this.syncStateRepo.save(state);
		}

		// If previous run finished, start a new one
		if (state.is_complete) {
			state.sync_from_date = state.completed_at ?? new Date('2000-01-01');
			state.current_offset = 0;
			state.total_count = 0;
			state.error_try = 0;
			state.is_complete = false;
			state.started_at = new Date();
			state.completed_at = null;
			state = await this.syncStateRepo.save(state);
			this.fileLogger.info(`TokkoSync New run started — syncing from ${state.sync_from_date.toISOString()}`);
			this.logger.log(`${label} New run — syncing from ${state.sync_from_date.toISOString()}`);
		} else {
			this.logger.log(
				`${label} Resuming run at offset ${state.current_offset}/${state.total_count}`,
			);
		}

		let batchResult: TokkoBatchResult;
		try {
			batchResult = await this.fetchAndProcessBatch(state, filter, processItem, feedbackContext);
		} catch (err) {
			const msg = this.extractErrorMessage(err);
			this.logger.error(`${label} Unexpected batch exception: ${msg}`);
			this.fileLogger.error(`${label} Unexpected batch exception: ${msg}`, err);
			batchResult = {
				ok: false,
				reason: 'UNEXPECTED_BATCH_EXCEPTION',
				details: msg,
				dateFromUsed: this.buildDateFrom(state.sync_from_date),
				offset: state.current_offset,
				totalCount: state.total_count,
			};
		}

		if (!batchResult.ok) {
			await this.handleFailedBatch(state, label, batchResult);
		}
	}

	// ─── Batch Processing ────────────────────────────────────────────────────────

	private async fetchAndProcessBatch(
		state: TokkoSyncState,
		filter: string,
		processItem: (item: any) => Promise<string>,
		feedbackContext?: TokkoFeedbackContext,
	): Promise<TokkoBatchResult> {
		const label = `[TokkoSync:${state.sync_type}]`;
		// Format date as ISO without milliseconds for the API
		const dateFrom = this.buildDateFrom(state.sync_from_date);

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
			this.fileLogger.error(`${label} API fetch failed: ${result.error} — ${result.details ?? ''}`);
			return {
				ok: false,
				reason: 'API_FETCH_FAILED',
				details: result.details ? `${result.error}: ${result.details}` : result.error,
				dateFromUsed: dateFrom,
				offset: state.current_offset,
				totalCount: state.total_count,
			};
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
				await this.reportCriticalFeedbackFromError(
					feedbackContext,
					this.extractPublicationId(item),
					err,
					item?.id != null ? String(item.id) : undefined,
				);
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

		state.error_try = 0;

		await this.syncStateRepo.save(state);
		return { ok: true };
	}

	// ─── Deleted Property Processing ─────────────────────────────────────────────

	/**
	 * Marks a property as deleted in the local DB when it appears
	 * in the Tokko "filter=deleted" feed.
	 */
	private async processDeletedProperty(item: any): Promise<string> {

		this.fileLogger.warn('SYNC_DELETE  processDeletedProperty started');


		if (!item || typeof item !== 'object') {
			this.fileLogger.warn('DELETE_SKIPPED reason="invalid payload"');
			return 'skipped';
		}

		const publicationId = item.id != null ? String(item.id) : null;
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

	private async processProperty(
		item: any,
		_feedbackContext?: TokkoFeedbackContext,
	): Promise<'created' | 'updated' | 'skipped'> {
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

		this.logPayload('original_property', publicationId, item);
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
			this.logPayload('mapped_property', publicationId, mapped);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.fileLogger.error(`STEP mapping_failed pub_id=${publicationId} reason="${msg}"`, err);
			throw err;
		}

		// Separate scalar fields from relational payload
		const {
			images: _images,
			videos: _videos,
			attached: _attached,
			tags: _tags,
			multimedia360: _multimedia360,
			...scalarFields
		} = mapped as any;

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
			this.assertPropertyBelongsToImportedOrganization(
				existing,
				publicationId,
				orgId,
				branchId,
				userId,
			);
			this.fileLogger.info(`STEP db_update pub_id=${publicationId} property_id=${existing.id}`);
			this.logPayload('existing_property', publicationId, existing);

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
						this.fileLogger.warn(`UPDATE_WARNING pub_id=${publicationId} property_id=${existing.id} warning="${warning}"`);
					});
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.logDriverErrorContext('db_update_failed', err, publicationId);
				this.fileLogger.error(`STEP db_update_failed pub_id=${publicationId} reason="${msg}"`, err);
				throw err;
			}
			this.logger.debug(`[TokkoSync] Updated property id=${existing.id} pub=${publicationId}`);
			this.fileLogger.logItemUpdated(publicationId, existing.id!);

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
				this.logDriverErrorContext('db_create_failed', err, publicationId);
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
		const partnerId = await this.resolveTokkoPartnerId();

		if (!companyId) {
			throw new Error('seller.company_id is required to resolve organization');
		}
		if (!partnerId) {
			throw new Error('Tokko partner is not configured, cannot resolve organization');
		}

		this.fileLogger.info(`STEP org_lookup ext_ref=${companyId}`);
		// Find org by external_reference + source_partner_id, including soft-deleted rows.
		// The DB unique key is (source_partner_id, external_reference), so this must match it.
		let org = await this.organizationRepo.findOne({
			where: {
				external_reference: companyId,
				source_partner_id: partnerId,
			} as any,
			relations: ['admin_user'],
		});

		if (org?.deleted) {
			this.fileLogger.warn(`STEP org_restore ext_ref=${companyId} org_id=${org.id} deleted=true -> false`);
			await this.organizationRepo.update(org.id!, { deleted: false, status: true } as any);
			org = await this.organizationRepo.findOne({
				where: { id: org.id } as any,
				relations: ['admin_user'],
			});
		}

		// Validar si existe un usuario con el email antes de crear la organización
		const sellerEmail = String(seller.email ?? '').trim();
		const existingUser = sellerEmail
			? await this.usersService.findByEmailWithOrganization(sellerEmail)
			: null;
		let adoptedExistingUserOrg = false;

		if (!org && existingUser) {
			const resolved = await this.resolveMissingTokkoOrganizationFromExistingUser(
				existingUser,
				seller,
				companyId,
				partnerId,
			);
			org = resolved.org;
			adoptedExistingUserOrg = resolved.adoptedExistingUserOrg;
		}

		if (!org) {
			this.fileLogger.info(`STEP org_create ext_ref=${companyId} company="${seller.company_name ?? 'N/A'}"`);
			try {
				org = await this.createOrgFromSeller(seller);
			} catch (err) {
				if (this.isOrgPartnerExternalRefUniqueViolation(err)) {
					const existingOrgByConstraint = await this.organizationRepo.findOne({
						where: {
							external_reference: companyId,
							source_partner_id: partnerId,
						} as any,
						relations: ['admin_user'],
					});

					if (existingOrgByConstraint) {
						org = existingOrgByConstraint;
						this.logger.warn(
							`[TokkoSync] Organization race resolved. Reusing org id=${org.id} ext_ref=${companyId}`,
						);
						this.fileLogger.warn(
							`STEP org_create_race_reused ext_ref=${companyId} org_id=${org.id}`,
						);
					} else {
						const msg = err instanceof Error ? err.message : String(err);
						this.fileLogger.error(`STEP org_create_failed ext_ref=${companyId} reason="${msg}"`, err);
						throw err;
					}
				} else {
					const msg = err instanceof Error ? err.message : String(err);
					this.fileLogger.error(`STEP org_create_failed ext_ref=${companyId} reason="${msg}"`, err);
					throw err;
				}
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

		const branch = await this.resolveBranchForOrganization(
			org,
			seller,
			branchExtRef,
			adoptedExistingUserOrg,
		);

		let adminUserId: number | undefined = (org as any).admin_user?.id;
		
		// Si el email del seller es diferente al del admin_user de la organización, y existe un usuario con ese email, 
		// asociar ese usuario a la organización y branch correspondientes. Si no existe un usuario con ese email, 
		// crear uno nuevo asociado a la organización y branch. Esto permite que cada vendedor tenga su propio usuario para acceder a Metroprop, 
		// en lugar de compartir el usuario admin de la organización.
		if (this.normalizeEmail(seller.email) !== this.normalizeEmail(org.admin_user?.email)) {
			this.fileLogger.info(`EL EMAIL ASIGNADo AL USUARIO ADMIN DE LA ORG ES DIFERENTE AL EMAIL DEL VENDEDOR. SE INTENTARÁ ASOCIAR O CREAR UN USUARIO PARA EL VENDEDOR. seller_email=${seller.email} admin_email=${org.admin_user?.email}`);
			if (existingUser) {
				this.fileLogger.info(`SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE ASOCIARÁ A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. user_id=${existingUser.id} email=${existingUser.email}`);
				adminUserId = existingUser.id;
			} else {
				this.fileLogger.info(`NO SE ENCONTRÓ UN USUARIO EXISTENTE CON EL EMAIL DEL VENDEDOR. SE CREARÁ UN NUEVO USUARIO ASOCIADO A LA ORGANIZACIÓN Y BRANCH CORRESPONDIENTES. seller_email=${seller.email}`);
				try {
					const newUser = await this.usersService.create({
						name: seller.branch_name ?? seller.company_name ?? 'Seller',
						email: seller.email ?? '',
						password: PASSWORD_DEFAULT,
						role_id: UserRole.USER_ROL_COLLABORATOR,
						organizationId: org.id,
						branchIds: [branch.id],
						is_verified: true,
						phone: this.buildTokkoPhone(seller.phone_country_code, seller.phone_area_code, seller.phone),
						phone_whatsapp: this.buildTokkoPhone(seller.alternative_phone_country_code, seller.alternative_phone_area_code, seller.alternative_phone),
						phone_alternative: this.buildTokkoPhone(seller.alternative_phone_country_code, seller.alternative_phone_area_code, seller.alternative_phone),
					} as any);
					adminUserId = newUser.id;
					this.fileLogger.info(`USUARIO CREADO PARA EL VENDEDOR. user_id=${newUser.id} email=${newUser.email}`);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					this.fileLogger.error(`ERROR AL CREAR USUARIO PARA EL VENDEDOR. seller_email=${seller.email} reason="${msg}"`, err);
					this.fileLogger.info(`SE USARÁ EL USUARIO ADMIN EXISTENTE PARA EL VENDEDOR. user_id=${org.admin_user?.id} email=${org.admin_user?.email}`);
					adminUserId = org.admin_user?.id;
				}
			}
		}

		// Ensure the resolved user is linked in users_branches
		if (adminUserId && branch?.id) {
			await this.usersService.addBranchToUser(adminUserId, branch.id);
		}

		return { orgId: org.id!, branchId: branch.id!, userId: adminUserId };
	}

	private async resolveMissingTokkoOrganizationFromExistingUser(
		existingUser: any,
		seller: any,
		companyId: string,
		partnerId: number,
	): Promise<{ org: Organization | null; adoptedExistingUserOrg: boolean }> {
		const userOrgId = existingUser.organization_id ?? existingUser.organization?.id;

		if (userOrgId) {
			let userOrg = await this.organizationRepo.findOne({
				where: { id: userOrgId } as any,
				relations: ['admin_user'],
			});

			if (!userOrg) {
				this.fileLogger.warn(
					`STEP org_user_reference_not_found user_id=${existingUser.id} org_id=${userOrgId}`,
				);
			} else {
				const userOrgExternalRef = userOrg.external_reference?.trim() ?? null;

				if (userOrgExternalRef && userOrgExternalRef !== companyId) {
					const msg =
						`EXISTING_USER_ORG_EXTERNAL_REF_MISMATCH user_id=${existingUser.id} ` +
						`org_id=${userOrg.id} org_external_ref=${userOrgExternalRef} tokko_company_id=${companyId}`;
					this.fileLogger.error(msg);
					throw new Error(msg);
				}

				if (userOrg.source_partner_id != null && userOrg.source_partner_id !== partnerId) {
					const msg =
						`EXISTING_USER_ORG_PARTNER_MISMATCH user_id=${existingUser.id} org_id=${userOrg.id} ` +
						`org_partner_id=${userOrg.source_partner_id} tokko_partner_id=${partnerId}`;
					this.fileLogger.error(msg);
					throw new Error(msg);
				}

				const needsUpdate =
					userOrgExternalRef == null ||
					userOrg.source_partner_id == null ||
					userOrg.deleted ||
					userOrg.status === false;

				if (needsUpdate) {
					const nextExternalRef = userOrgExternalRef ?? companyId;
					try {
						await this.organizationRepo.update(userOrg.id!, {
							external_reference: nextExternalRef,
							source_partner_id: partnerId,
							deleted: false,
							status: true,
						} as any);
					} catch (err) {
						if (this.isOrgPartnerExternalRefUniqueViolation(err)) {
							const msg =
								`EXISTING_USER_ORG_EXTERNAL_REF_TAKEN user_id=${existingUser.id} org_id=${userOrg.id} ` +
								`tokko_company_id=${companyId}`;
							this.fileLogger.error(msg, err);
							throw new Error(msg);
						}
						throw err;
					}

					userOrg = await this.organizationRepo.findOne({
						where: { id: userOrg.id } as any,
						relations: ['admin_user'],
					});
				}

				if (!userOrg) {
					throw new Error('Failed to reload existing user organization after update');
				}

				this.fileLogger.info(
					`STEP org_adopted_from_existing_user user_id=${existingUser.id} org_id=${userOrg.id} ` +
					`ext_ref=${userOrg.external_reference ?? 'N/A'} partner_id=${userOrg.source_partner_id ?? 'N/A'}`,
				);

				return { org: userOrg, adoptedExistingUserOrg: true };
			}
		}

		this.fileLogger.info(
			`STEP org_create_for_existing_user user_id=${existingUser.id} ext_ref=${companyId} company="${seller.company_name ?? 'N/A'}"`,
		);

		let createdOrg: Organization | null = null;
		try {
			const created = await this.organizationsService.create({
				company_name: seller.company_name ?? 'Unknown',
				email: seller.email ?? '',
				address: seller.address ?? '',
				phone: this.buildTokkoPhone(seller.phone_country_code, seller.phone_area_code, seller.phone),
				alternative_phone: this.buildTokkoPhone(
					seller.alternative_phone_country_code,
					seller.alternative_phone_area_code,
					seller.alternative_phone,
				),
				contact_time: seller.contact_time ?? '',
				geo_lat: seller.geo_lat ?? undefined,
				geo_long: seller.geo_long ?? undefined,
				full_location: seller.full_location ?? undefined,
				external_reference: companyId,
				company_logo: seller.company_logo ?? undefined,
				status: true,
				deleted: false,
				source_partner_id: partnerId,
				adminUserId: existingUser.id,
			} as any);

			await this.usersService.assignOrganizationAndRole(
				existingUser.id,
				created.id!,
				UserRole.USER_ROL_ADMIN,
			);

			createdOrg = await this.organizationRepo.findOne({
				where: { id: created.id } as any,
				relations: ['admin_user'],
			});

			this.fileLogger.logOrgCreated(companyId, created.id!, seller.email ?? '');
		} catch (err) {
			if (this.isOrgPartnerExternalRefUniqueViolation(err)) {
				const existingOrgByConstraint = await this.organizationRepo.findOne({
					where: {
						external_reference: companyId,
						source_partner_id: partnerId,
					} as any,
					relations: ['admin_user'],
				});

				if (existingOrgByConstraint) {
					await this.usersService.assignOrganizationAndRole(
						existingUser.id,
						existingOrgByConstraint.id!,
						UserRole.USER_ROL_ADMIN,
					);
					createdOrg = existingOrgByConstraint;
					this.fileLogger.warn(
						`STEP org_create_for_existing_user_race_reused ext_ref=${companyId} ` +
						`org_id=${existingOrgByConstraint.id} user_id=${existingUser.id}`,
					);
				} else {
					const msg = err instanceof Error ? err.message : String(err);
					this.fileLogger.error(`STEP org_create_for_existing_user_failed ext_ref=${companyId} reason="${msg}"`, err);
					throw err;
				}
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(`STEP org_create_for_existing_user_failed ext_ref=${companyId} reason="${msg}"`, err);
				throw err;
			}
		}

		if (!createdOrg) {
			throw new Error(`Failed to create organization for existing user id=${existingUser.id}`);
		}

		return { org: createdOrg, adoptedExistingUserOrg: false };
	}

	private async resolveBranchForOrganization(
		org: Organization,
		seller: any,
		branchExtRef: string | null,
		preferFirstBranchExternalRefAssignment: boolean,
	): Promise<any> {
		if (branchExtRef) {
			this.fileLogger.info(`STEP branch_lookup_or_create ext_ref=${branchExtRef} org_id=${org.id}`);

			const existingBranch = await this.branchesService.findByExternalReference(org.id!, branchExtRef);
			if (existingBranch) {
				this.fileLogger.info(
					`STEP branch_found ext_ref=${branchExtRef} branch_id=${existingBranch.id} org_id=${org.id}`,
				);
				return existingBranch;
			}

			if (preferFirstBranchExternalRefAssignment) {
				const firstBranch = await this.branchesService.findFirstByOrganizationId(org.id!);
				if (firstBranch && !firstBranch.external_reference) {
					try {
						const updatedBranch = await this.branchesService.update(firstBranch.id!, {
							external_reference: branchExtRef,
						} as any);
						this.fileLogger.info(
							`STEP branch_external_ref_assigned branch_id=${updatedBranch.id} ext_ref=${branchExtRef} org_id=${org.id}`,
						);
						return updatedBranch;
					} catch (err) {
						if (this.isBranchOrgExternalRefUniqueViolation(err)) {
							const winner = await this.branchesService.findByExternalReference(org.id!, branchExtRef);
							if (winner) {
								this.fileLogger.warn(
									`STEP branch_external_ref_assign_race_reused ext_ref=${branchExtRef} ` +
									`branch_id=${winner.id} org_id=${org.id}`,
								);
								return winner;
							}
						}
						const msg = err instanceof Error ? err.message : String(err);
						this.fileLogger.error(
							`STEP branch_external_ref_assign_failed ext_ref=${branchExtRef} org_id=${org.id} reason="${msg}"`,
							err,
						);
						throw err;
					}
				}
			}

			try {
				const result = await this.branchesService.findOrCreateByExternalReference(
					org.id!,
					branchExtRef,
					this.buildBranchPayloadFromSeller(seller, org),
				);
				const branch = result.branch;
				if (result.created) {
					this.logger.log(
						`[TokkoSync] Created new branch id=${branch.id} (ext_ref=${branchExtRef})`,
					);
					this.fileLogger.logBranchCreated(branchExtRef, branch.id!, org.id!);
					await this.linkOrgAdminToBranchIfPresent(org, branch.id);
				}
				return branch;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				this.fileLogger.error(
					`STEP branch_create_failed ext_ref=${branchExtRef} org_id=${org.id} reason="${msg}"`,
					err,
				);
				throw err;
			}
		}

		const firstBranch = await this.branchesService.findFirstByOrganizationId(org.id!);
		if (firstBranch) {
			this.fileLogger.info(`STEP branch_reused_first branch_id=${firstBranch.id} org_id=${org.id}`);
			return firstBranch;
		}

		this.fileLogger.info(`STEP branch_create ext_ref=N/A org_id=${org.id}`);
		try {
			const createdBranch = await this.branchesService.create(
				this.buildBranchPayloadFromSeller(seller, org),
			);
			this.logger.log(`[TokkoSync] Created new branch id=${createdBranch.id} (ext_ref=N/A)`);
			this.fileLogger.logBranchCreated(null, createdBranch.id!, org.id!);
			await this.linkOrgAdminToBranchIfPresent(org, createdBranch.id);
			return createdBranch;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.fileLogger.error(`STEP branch_create_failed ext_ref=N/A org_id=${org.id} reason="${msg}"`, err);
			throw err;
		}
	}

	private buildBranchPayloadFromSeller(orgSeller: any, org: Organization): any {
		return {
			branch_name: orgSeller.branch_name ?? orgSeller.company_name ?? 'Branch',
			email: orgSeller.email ?? org.email,
			phone: this.buildTokkoPhone(orgSeller.phone_country_code, orgSeller.phone_area_code, orgSeller.phone),
			alternative_phone: this.buildTokkoPhone(
				orgSeller.alternative_phone_country_code,
				orgSeller.alternative_phone_area_code,
				orgSeller.alternative_phone,
			),
			address: orgSeller.address ?? '',
			organizationId: org.id!,
			branch_logo: orgSeller.branch_logo ?? orgSeller.company_logo ?? undefined,
		} as any;
	}

	private async linkOrgAdminToBranchIfPresent(org: Organization, branchId: number): Promise<void> {
		const orgAdminId: number | undefined = (org as any).admin_user?.id;
		if (orgAdminId) {
			await this.usersService.addBranchToUser(orgAdminId, branchId);
		}
	}

	private isBranchOrgExternalRefUniqueViolation(err: unknown): boolean {
		const driverError = (err as any)?.driverError ?? err;
		return (
			driverError?.code === '23505' &&
			String(driverError?.constraint ?? '') === 'uk_branches_org_external_ref_active'
		);
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
			phone: this.buildTokkoPhone(seller.phone_country_code, seller.phone_area_code, seller.phone),
			alternative_phone: this.buildTokkoPhone(seller.alternative_phone_country_code, seller.alternative_phone_area_code, seller.alternative_phone),
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

		// Create admin user with hashed default password
		try {
			const adminUser = await this.usersService.create({
				name: seller.branch_name ?? seller.company_name ?? 'Admin',
				email: seller.email ?? '',
				password: PASSWORD_DEFAULT,
				role_id: UserRole.USER_ROL_ADMIN,
				organizationId: savedOrg.id,
				is_verified: true,
				phone: this.buildTokkoPhone(seller.phone_country_code, seller.phone_area_code, seller.phone),
				phone_whatsapp: this.buildTokkoPhone(seller.alternative_phone_country_code, seller.alternative_phone_area_code, seller.alternative_phone),
			} as any);

			await this.organizationRepo.update(savedOrg.id!, {
				admin_user: { id: adminUser.id } as any,
			});

			void this.emailService
				.sendProfessionalWelcomeEmailValidated(adminUser.email, adminUser.name)
				.catch((mailErr) => {
					const msg = this.extractErrorMessage(mailErr);
					this.logger.error(
						`[TokkoSync] Welcome email failed for admin user id=${adminUser.id}: ${msg}`,
					);
					this.fileLogger.error(
						`ADMIN_WELCOME_EMAIL_FAILED org_id=${savedOrg.id} user_id=${adminUser.id} email=${adminUser.email} reason="${msg}"`,
						mailErr,
					);
				});

			savedOrg.admin_user = adminUser as any;
		} catch (err) {
			// The email is already taken. Adopting that user as admin avoids leaving the
			// org without one, which would retry (and fail) this same create on every
			// property of the organization.
			const fallbackAdmin = await this.usersService.findByEmail(seller.email);

			if (fallbackAdmin) {
				await this.organizationRepo.update(savedOrg.id!, {
					admin_user: { id: fallbackAdmin.id } as any,
				});
				await this.usersService.assignOrganizationAndRole(
					fallbackAdmin.id,
					savedOrg.id!,
					UserRole.USER_ROL_ADMIN,
				);
				savedOrg.admin_user = fallbackAdmin as any;
				this.fileLogger.warn(
					`ADMIN_USER_REUSED org_id=${savedOrg.id} user_id=${fallbackAdmin.id} email=${seller.email ?? 'N/A'}`,
				);
			} else {
				this.logger.warn(
					`[TokkoSync] Could not create admin user for org ${savedOrg.id}: ${(err as Error).message}`,
				);
				this.fileLogger.warn(
					`ADMIN_USER_FAILED org_id=${savedOrg.id} email=${seller.email ?? 'N/A'} reason="${(err as Error).message}"`,
				);
			}
		}

		return savedOrg;
	}

	private createFeedbackContext(source: TokkoFeedbackSource, apiKey: string): TokkoFeedbackContext {
		return {
			source,
			apiKey,
			enabled: apiKey.trim().length > 0,
			dedupe: new Set<string>(),
		};
	}

	private extractPublicationId(item: any): string | null {
		return item?.publication_id != null ? String(item.publication_id) : null;
	}

	private buildDateFrom(date: Date): string {
		return date.toISOString().split('.')[0];
	}

	private async handleFailedBatch(
		state: TokkoSyncState,
		label: string,
		failure: TokkoBatchFailureResult,
	): Promise<void> {
		const nextTry = (state.error_try ?? 0) + 1;
		state.error_try = nextTry;

		const baseMessage =
			`${label} Batch failed reason=${failure.reason} try=${nextTry} ` +
			`sync_type=${state.sync_type} from=${failure.dateFromUsed} ` +
			`offset=${failure.offset} total=${failure.totalCount} details="${failure.details ?? 'N/A'}"`;

		this.logger.warn(baseMessage);
		this.fileLogger.warn(`TOKKO_BATCH_RETRY ${baseMessage}`);

		if (nextTry >= 2) {
			await this.notifyRetryFailure(state, failure);
		}

		await this.syncStateRepo.save(state);
	}

	private async notifyRetryFailure(
		state: TokkoSyncState,
		failure: TokkoBatchFailureResult,
	): Promise<void> {
		try {
			await this.emailService.sendTokkoSyncFailureNotification({
				occurredAt: new Date(),
				syncType: state.sync_type,
				syncFromDate: state.sync_from_date,
				offset: failure.offset,
				totalCount: failure.totalCount,
				errorTry: state.error_try,
				dateFromUsed: failure.dateFromUsed,
				reason: failure.reason,
				details: failure.details,
				apiKey: state.api_key,
			});
			this.fileLogger.info(
				`TOKKO_BATCH_RETRY_EMAIL_SENT sync_type=${state.sync_type} try=${state.error_try} from=${failure.dateFromUsed} offset=${failure.offset} total=${failure.totalCount}`,
			);
		} catch (err) {
			const msg = this.extractErrorMessage(err);
			this.logger.error(`[TokkoSync] Failed to send retry email notification: ${msg}`);
			this.fileLogger.error(`[TokkoSync] Failed to send retry email notification: ${msg}`, err);
		}
	}

	private async reportCriticalFeedbackFromError(
		feedbackContext: TokkoFeedbackContext | undefined,
		publicationId: string | null,
		err: unknown,
		tokkoId?: string,
	): Promise<void> {
		if (!feedbackContext?.enabled) {
			return;
		}

		const critical = this.buildCriticalFeedbackFromError(err);
		if (!critical) {
			this.fileLogger.feedbackSkippedNonCritical(
				feedbackContext.source,
				publicationId ?? undefined,
				this.toSingleLine(this.extractErrorMessage(err), 180),
			);
			return;
		}

		await this.sendCriticalTokkoFeedback(feedbackContext, {
			publicationId,
			tokkoId,
			reasonCode: critical.reasonCode,
			message: critical.message,
		});
	}

	private buildCriticalFeedbackFromError(
		err: unknown,
	): { reasonCode: string; message: string } | null {
		const rawMessage = this.extractErrorMessage(err);
		const normalized = rawMessage.toUpperCase();

		if (normalized.includes('PUBLICATION_OWNERSHIP_MISMATCH')) {
			return {
				reasonCode: 'PUBLICATION_OWNERSHIP_MISMATCH',
				message:
					'No se pudo publicar el aviso porque el publication_id ya existe en Metroprop y pertenece a otra inmobiliaria o a otro usuario.',
			};
		}

		if (normalized.includes('EXISTING_USER_ORG_EXTERNAL_REF_MISMATCH')) {
			return {
				reasonCode: 'ORG_USER_EXTERNAL_REF_MISMATCH',
				message:
					'No se pudo publicar el aviso porque el usuario ya pertenece a una organizacion con otro external_reference.',
			};
		}

		if (normalized.includes('EXISTING_USER_ORG_PARTNER_MISMATCH')) {
			return {
				reasonCode: 'ORG_USER_PARTNER_MISMATCH',
				message:
					'No se pudo publicar el aviso porque el usuario ya pertenece a otra inmobiliaria o partner.',
			};
		}

		if (normalized.includes('EXISTING_USER_ORG_EXTERNAL_REF_TAKEN')) {
			return {
				reasonCode: 'ORG_EXTERNAL_REF_TAKEN',
				message:
					'No se pudo publicar el aviso porque el external_reference de la organizacion ya esta en uso.',
			};
		}

		if (this.isPublicationValidationError(err, rawMessage)) {
			return {
				reasonCode: 'PUBLICATION_VALIDATION_FAILED',
				message: this.buildValidationFeedbackMessage(err, rawMessage),
			};
		}

		return null;
	}

	private isPublicationValidationError(err: unknown, rawMessage?: string): boolean {
		const anyErr = err as any;
		const status = Number(anyErr?.status ?? anyErr?.response?.status ?? 0);
		if (status === 400 || status === 422) {
			return true;
		}

		const name = String(anyErr?.name ?? '').toUpperCase();
		if (name.includes('BADREQUESTEXCEPTION') || name.includes('UNPROCESSABLEENTITYEXCEPTION')) {
			return true;
		}

		const driverCandidate = anyErr?.driverError ?? anyErr;
		const driverCode = String(driverCandidate?.code ?? '');
		if (['23502', '23505', '23514', '22P02', '22001'].includes(driverCode)) {
			return true;
		}

		const normalizedMessage = (rawMessage ?? this.extractErrorMessage(err)).toUpperCase();
		const markers = [
			'VALIDACION',
			'VALIDACION DE DATOS',
			'REQUISITO',
			'REQUIRED',
			'OBLIGATORIO',
			'INVALID',
			'INVÁLIDO',
			'INVALI',
			'YA EXISTE',
			'UK_PROPERTIES_PUBLICATION_ID',
			'NO SE PUDO GUARDAR LA PROPIEDAD',
			'NULL VALUE',
			'NOT-NULL',
			'CONSTRAINT',
		];

		return markers.some((marker) => normalizedMessage.includes(marker));
	}

	private buildValidationFeedbackMessage(err: unknown, rawMessage?: string): string {
		const anyErr = err as any;
		const driverCandidate = anyErr?.driverError ?? anyErr;
		const driverCode = String(driverCandidate?.code ?? '').toUpperCase();
		const normalizedMessage = (rawMessage ?? this.extractErrorMessage(err)).toUpperCase();

		if (
			driverCode === '23505' ||
			normalizedMessage.includes('UK_PROPERTIES_PUBLICATION_ID') ||
			normalizedMessage.includes('YA EXISTE')
		) {
			return 'No se pudo publicar el aviso porque el publication_id ya existe en Metroprop.';
		}

		if (
			driverCode === '23502' ||
			normalizedMessage.includes('REQUIRED') ||
			normalizedMessage.includes('OBLIGATORIO') ||
			normalizedMessage.includes('NULL VALUE') ||
			normalizedMessage.includes('NOT-NULL')
		) {
			return 'No se pudo publicar el aviso porque faltan datos obligatorios.';
		}

		if (
			driverCode === '22P02' ||
			driverCode === '22001' ||
			normalizedMessage.includes('INVALID') ||
			normalizedMessage.includes('FORMATO')
		) {
			return 'No se pudo publicar el aviso porque algunos datos tienen un formato invalido.';
		}

		if (driverCode === '23514' || normalizedMessage.includes('CONSTRAINT')) {
			return 'No se pudo publicar el aviso porque no cumple una regla de validacion.';
		}

		return 'No se pudo publicar el aviso por una validacion de datos.';
	}

	private assertPropertyBelongsToImportedOrganization(
		existing: any,
		publicationId: string,
		expectedOrganizationId: number,
		expectedBranchId: number,
		expectedUserId?: number,
	): void {
		const existingOrganizationId = existing?.organization_id ?? null;
		if (existingOrganizationId === expectedOrganizationId) {
			return;
		}

		const message =
			`PUBLICATION_OWNERSHIP_MISMATCH pub_id=${publicationId} property_id=${existing?.id ?? 'N/A'} ` +
			`existing_org_id=${existingOrganizationId ?? 'NULL'} incoming_org_id=${expectedOrganizationId} ` +
			`existing_branch_id=${existing?.branch_id ?? 'NULL'} incoming_branch_id=${expectedBranchId} ` +
			`existing_user_id=${existing?.user_id ?? 'NULL'} incoming_user_id=${expectedUserId ?? 'NULL'}`;

		this.fileLogger.error(`STEP ownership_guard_failed ${message}`);
		throw new Error(message);
	}

	private async sendCriticalTokkoFeedback(
		feedbackContext: TokkoFeedbackContext | undefined,
		params: {
			publicationId: string | null;
			tokkoId?: string;
			reasonCode: string;
			message: string;
		},
	): Promise<void> {
		if (!feedbackContext?.enabled) {
			return;
		}

		if (!params.publicationId) {
			this.fileLogger.feedbackSkippedNoPublicationId(feedbackContext.source, params.reasonCode);
			return;
		}

		const dedupeKey = `${params.publicationId}|${params.reasonCode}`;
		if (feedbackContext.dedupe.has(dedupeKey)) {
			this.fileLogger.info(
				`TOKKO_FEEDBACK_SKIPPED_DUPLICATE source=${feedbackContext.source} pub_id=${params.publicationId} reason=${params.reasonCode}`,
			);
			return;
		}

		feedbackContext.dedupe.add(dedupeKey);

		const feedbackObject: TokkoFeedbackObject = {
			publication_id: params.publicationId,
			status: '4',
			errors: [{ message: this.toSingleLine(params.message, 220) }],
		};

		if (params.tokkoId) {
			feedbackObject.id = params.tokkoId;
		}

		try {
			await notifyTokkoPublicationFeedback({
				apiKey: feedbackContext.apiKey,
				objects: [feedbackObject],
			});
			this.fileLogger.feedbackSent(
				feedbackContext.source,
				params.publicationId,
				params.reasonCode,
			);
		} catch (notifyErr) {
			this.fileLogger.feedbackFailed(
				feedbackContext.source,
				params.publicationId,
				params.reasonCode,
				notifyErr,
			);
		}
	}

	private extractErrorMessage(err: unknown): string {
		if (err instanceof Error) {
			return err.message;
		}

		const anyErr = err as any;
		if (Array.isArray(anyErr?.message)) {
			return anyErr.message.join('; ');
		}

		if (typeof anyErr?.message === 'string') {
			return anyErr.message;
		}

		return String(err);
	}

	private toSingleLine(value: string, maxLength: number): string {
		const oneLine = (value ?? '').replace(/\s+/g, ' ').trim();
		if (oneLine.length <= maxLength) {
			return oneLine;
		}
		return `${oneLine.slice(0, maxLength)}...`;
	}

	private async resolveTokkoPartnerId(): Promise<number | null> {
		if (this.tokkoPartnerId) {
			return this.tokkoPartnerId;
		}

		const tokkoPartner = await this.partnersService.findByName(TOKKO_PARTNER_NAME);

		if (!tokkoPartner) {
			this.logger.warn('[TokkoSync] Partner "tokko" not found; skipping sync run');
			this.fileLogger.warn('TOKKO_PARTNER_NOT_FOUND name="tokko"');
			return null;
		}

		this.tokkoPartnerId = tokkoPartner.id;
		return this.tokkoPartnerId;
	}

	private normalizeEmail(email?: string | null): string {
		return (email ?? '').trim().toLowerCase();
	}

	private isOrgPartnerExternalRefUniqueViolation(err: unknown): boolean {
		const driverError = (err as any)?.driverError;
		return (
			driverError?.code === '23505' &&
			String(driverError?.constraint ?? '') === 'uk_organizations_partner_external_ref'
		);
	}

	/**
	 * Full payloads are only useful while debugging a specific item, and they are
	 * by far the largest contributor to log volume, so they stay opt-in.
	 */
	private get payloadLoggingEnabled(): boolean {
		return this.configService.get<string>('TOKKO_SYNC_LOG_PAYLOADS') === 'true';
	}

	private logPayload(step: string, publicationId: string, payload: unknown): void {
		if (!this.payloadLoggingEnabled) return;

		let serialized: string;
		try {
			serialized = JSON.stringify(payload);
		} catch {
			serialized = String(payload);
		}
		this.fileLogger.info(`STEP ${step} pub_id=${publicationId} data=${serialized}`);
	}

	private logDriverErrorContext(step: string, err: unknown, publicationId: string): void {
		const driverError = (err as any)?.driverError;
		if (!driverError) return;

		const parts: string[] = [];
		if (driverError.code) parts.push(`code=${driverError.code}`);
		if (driverError.constraint) parts.push(`constraint=${driverError.constraint}`);
		if (driverError.column) parts.push(`column=${driverError.column}`);
		if (driverError.detail) parts.push(`detail="${String(driverError.detail).replace(/\s+/g, ' ').trim()}"`);
		if (driverError.hint) parts.push(`hint="${String(driverError.hint).replace(/\s+/g, ' ').trim()}"`);

		if (parts.length > 0) {
			this.fileLogger.error(
				`STEP ${step}_driver pub_id=${publicationId} ${parts.join(' ')}`,
			);
		}
	}

	// ─── Phone Helpers ─────────────────────────────────────────────────────────────

	/**
	 * Concatenates Tokko's split phone parts (country_code + area_code + number)
	 * into a single string, omitting empty segments.
	 * e.g. buildTokkoPhone('+549', '11', '65209938') → '+549 11 65209938'
	 *      buildTokkoPhone('', '011', '48712777')   → '011 48712777'
	 */
	private buildTokkoPhone(countryCode?: string, areaCode?: string, number?: string): string {
		return [countryCode, areaCode, number]
			.filter((s): s is string => !!s && s.trim() !== '')
			.join(' ')
			.trim();
	}

}
