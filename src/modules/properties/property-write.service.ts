import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not } from 'typeorm';
import { Property } from './entities/property.entity';
import { calculateSquareMetterPrice } from './helpers/properties-helper';
import { PropertyTag } from './entities/property-tag.entity';
import { PropertyVideo } from './entities/property-video.entity';
import { MediaUploadStatus } from '@/common/enums';

export interface VideoInput {
  url: string;
  provider?: string;
  title?: string;
  order?: number;
}

export interface Multimedia360Input {
  url: string;
  order?: number;
}

export interface PropertyCoreContext {
  organizationId?: number;
  branchId?: number;
  userId?: number;
  tags?: number[];
  videos?: VideoInput[];
  multimedia360?: Multimedia360Input[];
}

@Injectable()
export class PropertyWriteService {
  private readonly logger = new Logger(PropertyWriteService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyTag)
    private readonly propertyTagRepo: Repository<PropertyTag>,
    @InjectRepository(PropertyVideo)
    private readonly propertyVideoRepo: Repository<PropertyVideo>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates the property entity and synchronises tags, videos, and multimedia360.
   * Caller is responsible for any file uploads (images, attached) that are
   * specific to its own flow.
   */
  async createPropertyCore(
    scalars: Record<string, any>,
    context: PropertyCoreContext & { images?: any[]; attached?: any[] } = {},
  ): Promise<{ property: Property; warnings: string[] }> {
    const { organizationId, branchId, userId, tags, videos, multimedia360, images, attached } = context;

    // The property and its relations are written atomically: if any relation sync
    // fails the base row is rolled back instead of leaving a half-built property.
    return this.dataSource.transaction(async (manager) => {
      const warnings: string[] = [];
      const propertyRepo = manager.getRepository(Property);

      if (scalars.deleted !== true) {
        await this.assertUniquePublicationId(scalars.publication_id, undefined, manager);
      }

      // Calcular y asignar price_square_meter usando la función unificada
      scalars.price_square_meter = await calculateSquareMetterPrice(scalars, propertyRepo);

      const newProperty: Property = propertyRepo.create({
        ...scalars,
        ...(organizationId !== undefined ? { organization_id: organizationId } : {}),
        ...(branchId !== undefined ? { branch_id: branchId } : {}),
        ...(userId !== undefined ? { user_id: userId } : {})
      });

      let savedProperty: Property;
      try {
        savedProperty = (await propertyRepo.save(newProperty)) as unknown as Property;
      } catch (err) {
        throw this.translatePublicationIdConflict(err);
      }

      const propertyId = this.ensureValidPropertyId(
        savedProperty?.id,
        'createPropertyCore',
        'No se pudo guardar la propiedad base; se omite sincronizacion de tags, videos, multimedia, imagenes y adjuntos',
      );

      if (tags && tags.length > 0) {
        const tagWarnings = await this.syncTags(propertyId, tags, manager);
        warnings.push(...tagWarnings);
      }

      if (videos && videos.length > 0) {
        await this.syncVideos(propertyId, videos, false, manager);
      }

      if (multimedia360 && multimedia360.length > 0) {
        await this.syncMultimedia360(propertyId, multimedia360, false, manager);
      }

      if (images && images.length > 0) {
        await this.syncImages(propertyId, images, manager);
      }

      if (attached && attached.length > 0) {
        await this.syncAttached(propertyId, attached, manager);
      }

      return { property: savedProperty, warnings };
    });
  }

  /**
   * Sincroniza imágenes de una propiedad: crea nuevas y elimina las que ya no están.
   * Para creación, simplemente inserta todas. Para update, compara y elimina/crea según corresponda.
   */
  async syncImages(propertyId: number, images: any[], manager?: EntityManager): Promise<void> {
    const validPropertyId = this.ensureValidPropertyId(
      propertyId,
      'syncImages',
      'Property id invalido; no se sincronizaran imagenes',
    );

    const imageRepo = (manager ?? this.dataSource.manager).getRepository('PropertyImage');

    // Obtener imágenes existentes
    const existing = await imageRepo.find({ where: { upload_status: Not(MediaUploadStatus.DELETING), property: { id: validPropertyId } } });

    // Mapear por la clave con la que se identifica una imagen ya persistida:
    // original_image para las externas, url para las subidas localmente.
    const existingMap = new Map(existing.map((img: any) => [img.original_image ?? img.url, img]));
    const incomingMap = new Map(images.map((img: any) => [img.url, img]));

    // Crear nuevas
    const toAdd = images.filter((img: any) => !existingMap.has(img.url));
    for (const img of toAdd) {
      const isExternal = img.url?.startsWith('http');
      const entity = imageRepo.create({
        ...img,
        url: img.url ?? '',
        original_image: isExternal ? (img.url ?? null) : null,
        property: { id: validPropertyId },
        upload_status: isExternal ? MediaUploadStatus.PENDING : MediaUploadStatus.COMPLETED,
        retry_count: 0,
      });
      await imageRepo.save(entity);
    }

    // Marcar como DELETING las que ya no están
    const toRemove = existing.filter((img: any) => !incomingMap.has(img.original_image ?? img.url));
    if (toRemove.length > 0) {
      const ids = toRemove.map((img: any) => img.id);
      // Bulk update: set upload_status = 'deleting' for all toRemove
      await imageRepo
        .createQueryBuilder()
        .update()
        .set({ upload_status: MediaUploadStatus.DELETING })
        .whereInIds(ids)
        .execute();
    }

    // Actualizar orden si cambia
    for (const img of existing) {
      const incoming = incomingMap.get(img.original_image ?? img.url);
      if (incoming && img.order_position !== incoming.order_position) {
        img.order_position = incoming.order_position;
        await imageRepo.save(img);
      }
    }

    this.logger.debug(
      `[syncImages] property_id=${validPropertyId} added=${toAdd.length} removed=${toRemove.length} existing=${existing.length}`,
    );
  }

  /**
   * Sincroniza archivos adjuntos de una propiedad: crea nuevos y elimina los que ya no están.
   * Para creación, simplemente inserta todos. Para update, compara y elimina/crea según corresponda.
   */
  async syncAttached(propertyId: number, attached: any[], manager?: EntityManager): Promise<void> {
    const validPropertyId = this.ensureValidPropertyId(
      propertyId,
      'syncAttached',
      'Property id invalido; no se sincronizaran adjuntos',
    );

    const attachedRepo = (manager ?? this.dataSource.manager).getRepository('PropertyAttached');

    // Obtener adjuntos existentes
    const existing = await attachedRepo.find({ where: { property: { id: validPropertyId } } });
    // Mapear por la clave con la que se identifica un adjunto ya persistido
    const existingMap = new Map(existing.map((a: any) => [a.original_file ?? a.file_url, a]));
    const incomingMap = new Map(attached.map((a: any) => [a.file_url, a]));

    // Crear nuevos
    const toAdd = attached.filter((a: any) => !existingMap.has(a.file_url));
    for (const a of toAdd) {
      const entity = attachedRepo.create({
        ...a,
        property: { id: validPropertyId },
        upload_status: a.file_url?.startsWith('http') ? MediaUploadStatus.PENDING : MediaUploadStatus.COMPLETED,
        upload_completed_at: null,
        retry_count: 0,
        original_file: a.file_url ?? null,
      });
      await attachedRepo.save(entity);
    }

    // Eliminar los que ya no están
    const toRemove = existing.filter((a: any) => !incomingMap.has(a.original_file ?? a.file_url));
    if (toRemove.length > 0) {
      const ids = toRemove.map((a: any) => a.id);
      await attachedRepo
        .createQueryBuilder()
        .update()
        .set({ upload_status: MediaUploadStatus.DELETING })
        .whereInIds(ids)
        .execute();
    }

    // Actualizar orden si cambia
    for (const a of existing) {
      const incoming = incomingMap.get(a.original_file ?? a.file_url);
      if (incoming && a.order_position !== incoming.order_position) {
        a.order_position = incoming.order_position;
        await attachedRepo.save(a);
      }
    }
  }

  /**
   * Updates an existing property's scalar fields and, optionally, its tags.
   * Video/multimedia360 sync is intentionally left to the caller so each
   * endpoint can apply its own replace-vs-append policy.
   */
  async updatePropertyCore(
    property: Property,
    scalars: Record<string, any>,
    context?: {
      organizationId?: number;
      branchId?: number;
      userId?: number;
      tags?: number[];
      videos?: any[];
      multimedia360?: any[];
      images?: any[];
      attached?: any[];
    },
  ): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];
    const propertyId = this.ensureValidPropertyId(
      property?.id,
      'updatePropertyCore',
      'Property id inexistente al actualizar; se omite sincronizacion de relaciones',
    );

    // Campos que nunca se pueden sobreescribir en un update
    const { reference_code, organization_id, development_id, deleted, ...restScalars } = scalars;
    const updateData: any = { ...restScalars };

    if (context?.organizationId) updateData.organization_id = context.organizationId;
    if (context?.branchId) updateData.branch_id = context.branchId;
    if (context?.userId) updateData.user_id = context.userId;

    // `deleted` no se puede cambiar desde un update, por eso se toma siempre el valor actual
    const nextPublicationId = updateData.publication_id ?? property.publication_id;
    if (property.deleted !== true) {
      await this.assertUniquePublicationId(nextPublicationId, property.id);
    }

    const nextState = { ...property, ...updateData };
    updateData.price_square_meter = await calculateSquareMetterPrice(nextState, this.propertyRepo);

    // Use direct update to avoid cascading loaded relations (images/tags/videos/attached)
    // which can accidentally trigger invalid FK updates on relation tables.
    try {
      await this.propertyRepo.update({ id: propertyId }, updateData);
    } catch (err) {
      throw this.translatePublicationIdConflict(err);
    }

    if (context?.tags !== undefined) {
      await this.propertyTagRepo.delete({ property: { id: propertyId } });
      if (context.tags.length > 0) {
        const tagWarnings = await this.syncTags(propertyId, context.tags);
        warnings.push(...tagWarnings);
      }
    }

    if (context?.videos) {
      await this.syncVideos(propertyId, context.videos, true);
    }
    if (context?.multimedia360) {
      await this.syncMultimedia360(propertyId, context.multimedia360, true);
    }
    if (context?.images) {
      await this.syncImages(propertyId, context.images);
    }
    if (context?.attached) {
      await this.syncAttached(propertyId, context.attached);
    }

    return { warnings };
  }

  /**
   * Validates tag IDs against the tags table, inserts valid ones and returns
   * warnings for any that did not exist.
   */
  async syncTags(propertyId: number, tagIds: number[], manager?: EntityManager): Promise<string[]> {
    const validPropertyId = this.ensureValidPropertyId(
      propertyId,
      'syncTags',
      'Property id invalido; no se sincronizaran tags',
    );

    const warnings: string[] = [];
    const entityManager = manager ?? this.dataSource.manager;
    const tagRepo = entityManager.getRepository(PropertyTag);

    const existingTags = await entityManager.query(
      `SELECT id FROM tags WHERE id = ANY($1)`,
      [tagIds],
    );
    const existingIds = new Set(existingTags.map((t: { id: number }) => t.id));
    const validIds = tagIds.filter((id) => existingIds.has(id));
    const invalidIds = tagIds.filter((id) => !existingIds.has(id));

    if (validIds.length > 0) {
      const newTags = validIds.map((tagId) =>
        tagRepo.create({
          tag_id: tagId,
          property: { id: validPropertyId } as Property,
        }),
      );
      await tagRepo.save(newTags);
    }

    if (invalidIds.length > 0) {
      warnings.push(
        `Los siguientes tag IDs no existen y fueron ignorados: ${invalidIds.join(', ')}`,
      );
    }

    return warnings;
  }

  /**
   * Inserts (or replaces, when isUpdate=true) non-360 videos for a property.
   */
  async syncVideos(
    propertyId: number,
    videos: VideoInput[],
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    const validPropertyId = this.ensureValidPropertyId(
      propertyId,
      'syncVideos',
      'Property id invalido; no se sincronizaran videos',
    );

    const videoRepo = (manager ?? this.dataSource.manager).getRepository(PropertyVideo);

    if (isUpdate) {
      await videoRepo.delete({ property: { id: validPropertyId }, is_360: false });
    }

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const entity = videoRepo.create({
        url: v.url,
        property: { id: validPropertyId } as Property,
        is_360: false,
        order: v.order ?? i + 1,
      });
      await videoRepo.save(entity);
    }
  }

  /**
   * Inserts (or replaces, when isUpdate=true) 360-degree multimedia for a property.
   */
  async syncMultimedia360(
    propertyId: number,
    items: Multimedia360Input[],
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    const validPropertyId = this.ensureValidPropertyId(
      propertyId,
      'syncMultimedia360',
      'Property id invalido; no se sincronizara multimedia 360',
    );

    const videoRepo = (manager ?? this.dataSource.manager).getRepository(PropertyVideo);

    if (isUpdate) {
      await videoRepo.delete({ property: { id: validPropertyId }, is_360: true });
    }

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const entity = videoRepo.create({
        url: m.url,
        property: { id: validPropertyId } as Property,
        is_360: true,
        order: m.order ?? i + 1,
      });
      await videoRepo.save(entity);
    }
  }

  private async assertUniquePublicationId(
    publicationId: string | undefined | null,
    excludePropertyId?: number,
    manager?: EntityManager,
  ): Promise<void> {
    const normalized = publicationId?.trim();
    if (!normalized) return;

    const repo = manager ? manager.getRepository(Property) : this.propertyRepo;
    const qb = repo
      .createQueryBuilder('p')
      .where('p.publication_id = :publicationId', { publicationId: normalized })
      .andWhere('p.deleted = :deleted', { deleted: false });

    if (excludePropertyId != null) {
      qb.andWhere('p.id != :excludePropertyId', { excludePropertyId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        'Una propiedad activa con este publication_id ya existe',
      );
    }
  }

  /**
   * The pre-check in assertUniquePublicationId can lose a race against a
   * concurrent writer, so the DB constraint is the real guard. Translate its
   * violation into the same error the pre-check raises.
   */
  private translatePublicationIdConflict(err: unknown): unknown {
    const driverError = (err as any)?.driverError;
    const isPublicationIdConflict =
      driverError?.code === '23505' &&
      String(driverError?.constraint ?? '') === 'uk_properties_publication_id';

    if (isPublicationIdConflict) {
      return new BadRequestException(
        'Una propiedad activa con este publication_id ya existe',
      );
    }

    return err;
  }

  private ensureValidPropertyId(
    propertyId: number | undefined,
    context: string,
    reason: string,
  ): number {
    if (typeof propertyId === 'number' && Number.isInteger(propertyId) && propertyId > 0) {
      return propertyId;
    }

    // Solo se lanza: el caller es el responsable de loguearlo una unica vez.
    throw new Error(`[${context}] ${reason}. propertyId=${propertyId ?? 'undefined'}`);
  }

}
