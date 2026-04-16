import { Injectable } from '@nestjs/common';
import { S3Service } from '../../common/s3.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
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

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyTag)
    private readonly propertyTagRepo: Repository<PropertyTag>,
    @InjectRepository(PropertyVideo)
    private readonly propertyVideoRepo: Repository<PropertyVideo>,
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,
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
    const warnings: string[] = [];

    console.log('[createPropertyCore] INICIO', JSON.stringify({ scalars, organizationId, branchId, userId }, null, 2));
    if (images) console.log('[createPropertyCore] images:', JSON.stringify(images, null, 2));
    if (attached) console.log('[createPropertyCore] attached:', JSON.stringify(attached, null, 2));
    if (tags) console.log('[createPropertyCore] tags:', JSON.stringify(tags, null, 2));
    if (videos) console.log('[createPropertyCore] videos:', JSON.stringify(videos, null, 2));
    if (multimedia360) console.log('[createPropertyCore] multimedia360:', JSON.stringify(multimedia360, null, 2));
    let savedProperty: Property | undefined;
    try {
      // Calcular y asignar price_square_meter usando la función unificada
      scalars.price_square_meter = await calculateSquareMetterPrice(scalars, this.propertyRepo);
      const newProperty: Property = this.propertyRepo.create({
        ...scalars,
        ...(organizationId !== undefined ? { organization_id: organizationId } : {}),
        ...(branchId !== undefined ? { branch_id: branchId } : {}),
        ...(userId !== undefined ? { user_id: userId } : {})
      });
      console.log('[createPropertyCore] newProperty:', JSON.stringify(newProperty, null, 2));
      const saved = (await this.propertyRepo.save(newProperty)) as unknown as Property;
      console.log('[createPropertyCore] savedProperty:', JSON.stringify(saved, null, 2));
      if (!saved?.id) {
        console.error('[createPropertyCore] ERROR: savedProperty.id es undefined/null');
        throw new Error('No se pudo guardar la propiedad, id indefinido');
      }
      // Buscar la entidad completa desde la base de datos (con relaciones si es necesario)
      const found = await this.propertyRepo.findOne({ where: { id: saved.id } });
      savedProperty = found === null ? undefined : found;
      console.log('[createPropertyCore] savedProperty (from DB):', JSON.stringify(savedProperty, null, 2));
    } catch (err) {
      console.error('[createPropertyCore] ERROR al guardar propiedad:', err);
      throw err;
    }
    if (!savedProperty?.id) {
      console.error('[createPropertyCore] ERROR: savedProperty.id es undefined/null (post-find)');
      throw new Error('No se pudo guardar la propiedad, id indefinido (post-find)');
    }
    const propertyId = savedProperty.id;

    if (tags && tags.length > 0) {
      const tagWarnings = await this.syncTags(propertyId, tags);
      warnings.push(...tagWarnings);
    }

    if (videos && videos.length > 0) {
      await this.syncVideos(propertyId, videos, false);
    }

    if (multimedia360 && multimedia360.length > 0) {
      await this.syncMultimedia360(propertyId, multimedia360, false);
    }
    console.log('[createPropertyCore] Antes de syncImages/syncAttached. propertyId:', propertyId);
    if (images && images.length > 0) {
      await this.syncImages(propertyId, images);
    }

    if (attached && attached.length > 0) {
      await this.syncAttached(propertyId, attached);
    }

    return { property: savedProperty, warnings };
  }

  /**
   * Sincroniza imágenes de una propiedad: crea nuevas y elimina las que ya no están.
   * Para creación, simplemente inserta todas. Para update, compara y elimina/crea según corresponda.
   */
  async syncImages(propertyId: number, images: any[]): Promise<void> {
    // Obtener imágenes existentes
    const existing = await this.dataSource.getRepository('PropertyImage').find({ where: { upload_status: Not(MediaUploadStatus.DELETING), property: { id: propertyId } } });
    console.log("[syncImages] existing images from DB:", JSON.stringify(existing, null, 2));
    // Mapear por original_image
    const existingMap = new Map(existing.map((img: any) => [img.original_image, img]));
    const incomingMap = new Map(images.map((img: any) => [img.url, img]));
    console.log("[syncImages] existingMap:", JSON.stringify(Array.from(existingMap.entries()), null, 2));
    console.log("[syncImages] incomingMap:", JSON.stringify(Array.from(incomingMap.entries()), null, 2));

    // Crear nuevas
    const toAdd = images.filter((img: any) => !existingMap.has(img.url));
    console.log("[syncImages] images to add:", JSON.stringify(toAdd, null, 2));
    for (const img of toAdd) {
      const isExternal = img.url?.startsWith('http');
      const entity = this.dataSource.getRepository('PropertyImage').create({
        ...img,
        url: img.url ?? '',
        original_image: isExternal ? (img.url ?? null) : null,
        property: { id: propertyId },
        upload_status: isExternal ? MediaUploadStatus.PENDING : MediaUploadStatus.COMPLETED,
        retry_count: 0,
      });
      await this.dataSource.getRepository('PropertyImage').save(entity);
    }
    console.log("%%%%%%%%%%%%%% [syncImages] after adding new images, now checking for removals and order updates...");
    // Marcar como DELETING las que ya no están
    const toRemove = existing.filter((img: any) => !incomingMap.has(img.original_image ?? img.url)); // Usar original_image para comparación, fallback a url
    console.log("[syncImages] images to remove:", JSON.stringify(toRemove, null, 2));
    if (toRemove.length > 0) {
      console.log("############### [syncImages] marking images as DELETING...");
      const ids = toRemove.map((img: any) => img.id);
      // Bulk update: set upload_status = 'deleting' for all toRemove
      await this.dataSource.getRepository('PropertyImage')
        .createQueryBuilder()
        .update()
        .set({ upload_status: MediaUploadStatus.DELETING })
        .whereInIds(ids)
        .execute();
    }

    // Actualizar orden si cambia
    for (const img of existing) {
      const incoming = incomingMap.get(img.original_image ?? img.url); // Usar original_image para comparación, fallback a url
      if (incoming && img.order_position !== incoming.order_position) {
        img.order_position = incoming.order_position;
        await this.dataSource.getRepository('PropertyImage').save(img);
      }
    }
  }

  /**
   * Sincroniza archivos adjuntos de una propiedad: crea nuevos y elimina los que ya no están.
   * Para creación, simplemente inserta todos. Para update, compara y elimina/crea según corresponda.
   */
  async syncAttached(propertyId: number, attached: any[]): Promise<void> {
    // Obtener adjuntos existentes
    const existing = await this.dataSource.getRepository('PropertyAttached').find({ where: { property: { id: propertyId } } });
    // Mapear por original_file
    const existingMap = new Map(existing.map((a: any) => [a.original_file, a]));
    const incomingMap = new Map(attached.map((a: any) => [a.file_url, a]));

    // Crear nuevos
    const toAdd = attached.filter((a: any) => !existingMap.has(a.file_url));
    for (const a of toAdd) {
      const entity = this.dataSource.getRepository('PropertyAttached').create({
        ...a,
        property: { id: propertyId },
        upload_status: a.file_url?.startsWith('http') ? MediaUploadStatus.PENDING : MediaUploadStatus.COMPLETED,
        upload_completed_at: null,
        retry_count: 0,
        original_file: a.file_url ?? null,
      });
      await this.dataSource.getRepository('PropertyAttached').save(entity);
    }

    // Eliminar los que ya no están
    const toRemove = existing.filter((a: any) => !incomingMap.has(a.original_file ?? a.file_url)); // Usar original_file para comparación, fallback a file_url
    if (toRemove.length > 0) {
      const ids = toRemove.map((a: any) => a.id);
      await this.dataSource.getRepository('PropertyAttached')
        .createQueryBuilder()
        .update()
        .set({ upload_status: MediaUploadStatus.DELETING })
        .whereInIds(ids)
        .execute();
    }

    // Actualizar orden si cambia
    for (const a of existing) {
      const incoming = incomingMap.get(a.original_file ?? a.file_url); // Usar original_file para comparación, fallback a file_url
      if (incoming && a.order_position !== incoming.order_position) {
        a.order_position = incoming.order_position;
        await this.dataSource.getRepository('PropertyAttached').save(a);
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

    // No permitir actualizar reference_code
    const { reference_code, ...restScalars } = scalars;
    const updateData: any = { ...restScalars };
    if (context?.organizationId) updateData.organization_id = context.organizationId;
    if (context?.branchId) updateData.branch_id = context.branchId;
    if (context?.userId) updateData.user_id = context.userId;

    Object.assign(property, updateData);
    // Calcular y setear price_square_meter usando la función unificada
    property.price_square_meter = await calculateSquareMetterPrice({ ...property, ...updateData }, this.propertyRepo);

    await this.propertyRepo.save(property);

    if (context?.tags !== undefined) {
      await this.propertyTagRepo.delete({ property: { id: property.id } });
      if (context.tags.length > 0) {
        const tagWarnings = await this.syncTags(property.id!, context.tags);
        warnings.push(...tagWarnings);
      }
    }

    if (context?.videos) {
      await this.syncVideos(property.id!, context.videos, true);
    }
    if (context?.multimedia360) {
      await this.syncMultimedia360(property.id!, context.multimedia360, true);
    }
    if (context?.images) {
      console.log("$$$$$$$$$ context.images:", JSON.stringify(context.images, null, 2));
      //this.logger.log("$$$$$$$$$ context.images:", JSON.stringify(context.images, null, 2);
      await this.syncImages(property.id!, context.images);
    }
    if (context?.attached) {
      await this.syncAttached(property.id!, context.attached);
    }

    return { warnings };
  }

  /**
   * Validates tag IDs against the tags table, inserts valid ones and returns
   * warnings for any that did not exist.
   */
  async syncTags(propertyId: number, tagIds: number[]): Promise<string[]> {
    const warnings: string[] = [];

    const existingTags = await this.dataSource.query(
      `SELECT id FROM tags WHERE id = ANY($1)`,
      [tagIds],
    );
    const existingIds = new Set(existingTags.map((t: { id: number }) => t.id));
    const validIds = tagIds.filter((id) => existingIds.has(id));
    const invalidIds = tagIds.filter((id) => !existingIds.has(id));

    if (validIds.length > 0) {
      const newTags = validIds.map((tagId) =>
        this.propertyTagRepo.create({
          tag_id: tagId,
          property: { id: propertyId } as Property,
        }),
      );
      await this.propertyTagRepo.save(newTags);
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
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({ property: { id: propertyId }, is_360: false });
    }

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const entity = this.propertyVideoRepo.create({
        url: v.url,
        property: { id: propertyId } as Property,
        is_360: false,
        order: v.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }

  /**
   * Inserts (or replaces, when isUpdate=true) 360-degree multimedia for a property.
   */
  async syncMultimedia360(
    propertyId: number,
    items: Multimedia360Input[],
    isUpdate: boolean,
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({ property: { id: propertyId }, is_360: true });
    }

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const entity = this.propertyVideoRepo.create({
        url: m.url,
        property: { id: propertyId } as Property,
        is_360: true,
        order: m.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }


}
