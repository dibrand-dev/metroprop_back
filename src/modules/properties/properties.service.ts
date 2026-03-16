import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyWriteService } from './property-write.service';
import { UpdatePropertyDto } from './dto/update-property.dto';

import { MediaService } from '../../common/media/media.service';
import { PropertyVideo } from './entities/property-video.entity';
import { PropertyAttached } from './entities/property-attached.entity';
import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import axios from 'axios';
import { sanitizeFilename, getFileExtension, createUniqueFilename } from '../../common/helpers/file-helpers';

import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import {
  PropertyStatus,
  MediaUploadStatus,
  Currency,
} from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from 'typeorm';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(PropertyImage)
    private propertyImageRepository: Repository<PropertyImage>,
    @InjectRepository(PropertyVideo)
    private propertyVideoRepository: Repository<PropertyVideo>,
    @InjectRepository(PropertyAttached)
    private propertyAttachedRepository: Repository<PropertyAttached>,
    private readonly mediaService: MediaService,
    private readonly dataSource: DataSource,
    private readonly propertyWriteService: PropertyWriteService,
  ) {}


  /**
   * Valida cada archivo individualmente para dar mensajes de error específicos
   */
  validateUploadedFiles(files: { images?: Express.Multer.File[]; attached?: Express.Multer.File[] }) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    const allowedTypes = ['jpg', 'svg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const errors: string[] = [];

    // Validar imágenes
    if (files.images?.length) {
      files.images.forEach((file, index) => {
        // Validar tamaño
        if (file.size > maxSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          errors.push(`Imagen "${file.originalname}" (${fileSizeMB}MB) excede el límite de 25MB`);
        }
        
        // Validar tipo
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          errors.push(`Imagen "${file.originalname}" tiene tipo no válido. Permitidos: ${allowedTypes.join(', ')}`);
        }
      });
    }

    // Validar archivos adjuntos
    if (files.attached?.length) {
      files.attached.forEach((file, index) => {
        // Validar tamaño
        if (file.size > maxSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          errors.push(`Archivo "${file.originalname}" (${fileSizeMB}MB) excede el límite de 25MB`);
        }
        
        // Validar tipo
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          errors.push(`Archivo "${file.originalname}" tiene tipo no válido. Permitidos: ${allowedTypes.join(', ')}`);
        }
      });
    }

    // Si hay errores, lanzar excepción con detalles
    if (errors.length > 0) {
      throw new BadRequestException(`Errores de validación de archivos: ${errors.join('; ')}`);
    }
  }


  private buildAdvancedSearchQuery(
    filters: SearchPropertiesDto,
    options?: {
      organizationId?: number;  
      includeStatusFilter?: boolean;
    },
  ) {
    const qb = this.propertyRepository
      .createQueryBuilder('p')
      .leftJoin('organizations', 'org', 'p.organization_id = org.id')
      .where('p.deleted = :deleted', { deleted: false })
      .andWhere('org.status = :orgStatus', { orgStatus: true })
      .andWhere('org.deleted = :orgDeleted', { orgDeleted: false });

    const scopedOrganizationId = options?.organizationId ?? filters.organization_id;

    if (scopedOrganizationId != null) {
      qb.andWhere('p.organization_id = :organization_id', {
        organization_id: scopedOrganizationId,
      });
    }

    if (filters.branch_id != null) {
      qb.andWhere('p.branch_id = :branch_id', {
        branch_id: filters.branch_id,
      });
    }

    if (filters.user_id != null) {
      qb.andWhere('p.user_id = :user_id', {
        user_id: filters.user_id,
      });
    }

    if (options?.includeStatusFilter !== false && filters.status != null) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }

    if (filters.country_id != null) {
      qb.andWhere('p.country_id = :country_id', {
        country_id: filters.country_id,
      });
    }

    if (filters.state_id != null) {
      qb.andWhere('p.state_id = :state_id', { state_id: filters.state_id });
    }

    if (filters.location_id != null) {
      qb.andWhere('p.location_id = :location_id', {
        location_id: filters.location_id,
      });
    }

    if (filters.sub_location_id != null) {
      qb.andWhere('p.sub_location_id = :sub_location_id', {
        sub_location_id: filters.sub_location_id,
      });
    }

    if (filters.property_type?.length) {
      qb.andWhere('p.property_type IN (:...property_type)', {
        property_type: filters.property_type,
      });
    }

    if (filters.operation_type?.length) {
      qb.andWhere('p.operation_type IN (:...operation_type)', {
        operation_type: filters.operation_type,
      });
    }

    if (filters.currency) {
      qb.andWhere('p.currency = :currency', { currency: filters.currency });
    }

    if (filters.price_min != null) {
      qb.andWhere('p.price >= :price_min', { price_min: filters.price_min });
    }

    if (filters.price_max != null) {
      qb.andWhere('p.price <= :price_max', { price_max: filters.price_max });
    }

    if (filters.roofed_surface_min != null) {
      qb.andWhere('p.roofed_surface >= :roofed_surface_min', {
        roofed_surface_min: filters.roofed_surface_min,
      });
    }

    if (filters.roofed_surface_max != null) {
      qb.andWhere('p.roofed_surface <= :roofed_surface_max', {
        roofed_surface_max: filters.roofed_surface_max,
      });
    }

    if (filters.total_surface_min != null) {
      qb.andWhere('p.total_surface >= :total_surface_min', {
        total_surface_min: filters.total_surface_min,
      });
    }

    if (filters.total_surface_max != null) {
      qb.andWhere('p.total_surface <= :total_surface_max', {
        total_surface_max: filters.total_surface_max,
      });
    }

    if (filters.bathroom_amount?.length) {
      qb.andWhere('p.bathroom_amount IN (:...bathroom_amount)', {
        bathroom_amount: filters.bathroom_amount,
      });
    }

    if (filters.room_amount?.length) {
      qb.andWhere('p.room_amount IN (:...room_amount)', {
        room_amount: filters.room_amount,
      });
    }

    if (filters.suite_amount?.length) {
      qb.andWhere('p.suite_amount IN (:...suite_amount)', {
        suite_amount: filters.suite_amount,
      });
    }

    if (filters.parking_lot_amount?.length) {
      qb.andWhere('p.parking_lot_amount IN (:...parking_lot_amount)', {
        parking_lot_amount: filters.parking_lot_amount,
      });
    }

    if (filters.age_min != null) {
      qb.andWhere('p.antiquity >= :age_min', { age_min: filters.age_min });
    }

    if (filters.age_max != null) {
      qb.andWhere('p.antiquity <= :age_max', { age_max: filters.age_max });
    }

    if (filters.disposition?.length) {
      qb.andWhere('p.dispositions IN (:...disposition)', {
        disposition: filters.disposition,
      });
    }

    if (filters.q) {
      qb.andWhere(
        '(p.publication_title ILIKE :q OR p.street ILIKE :q OR p.reference_code ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    return qb;
  }

  /**
   * Crea una propiedad en estado borrador.
   * Rellena los campos obligatorios con valores por defecto.
   */
  async createDraft(createDraftDto: CreateDraftPropertyDto): Promise<Property> {
    const tempReferenceCode = `DRAFT-${uuidv4().substring(0, 8)}`;
    const tempTitle = `Borrador - ${tempReferenceCode}`;

    const newProperty = this.propertyRepository.create({
      ...createDraftDto,
      status: PropertyStatus.DRAFT,
      reference_code: tempReferenceCode,
      publication_title: tempTitle,
      price: 0,
      currency: Currency.USD,
    });

    return this.propertyRepository.save(newProperty);
  }

  /**
   * Si se envían images, tags, videos, multimedia360 o attached, se crearán automáticamente
   */
  async create(createPropertyDto: CreatePropertyDto): Promise<{ data: Property; warnings?: string[] }> {
    // 1. Extraer las relaciones y multimedia del DTO
    const {
      images,
      tags,
      videos,
      multimedia360,
      attached,
      ...propertyData
    } = createPropertyDto as any;

    // Verificar que no exista una propiedad con el mismo reference_code
    const existingProperty = await this.propertyRepository.findOne({
      where: { reference_code: propertyData.reference_code },
    });

    if (existingProperty) {
      throw new BadRequestException(
        'Una propiedad con este código de referencia ya existe',
      );
    }

    // Crear la propiedad base y sincronizar tags, videos y multimedia360
    const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
      { ...propertyData, deleted: false },
      { tags, videos, multimedia360 },
    );

    // 2. Guardar imágenes si se proporcionan (fire-and-forget)
    if (images && images.length > 0) {
      const imagesToProcess: {
        imageId: number;
        originalUrl: string;
        propertyId: number;
      }[] = [];
      for (const imageData of images) {
        const propertyImage = this.propertyImageRepository.create({
          ...imageData,
          url: imageData.url ?? '',
          property: savedProperty,
          upload_status: MediaUploadStatus.PENDING,
          retry_count: 0,
        });
        const savedImage = await this.propertyImageRepository.save(propertyImage) as unknown as PropertyImage;

        imagesToProcess.push({
          imageId: savedImage.id!,
          originalUrl: savedImage.url ?? '',
          propertyId: savedProperty.id!,
        });
      }

      // Disparar el proceso de subida en segundo plano SIN ESPERARLO (fire-and-forget)
      this.processAndUploadImages(imagesToProcess);
    }

    // 3. Crear archivos adjuntos si se proporcionan (fire-and-forget)
    if (attached && Array.isArray(attached) && attached.length > 0) {
      const savedAttachedList: PropertyAttached[] = [];

      for (const attachedData of attached) {
        const propertyAttached = this.propertyAttachedRepository.create({
          ...attachedData,
          property: savedProperty,
          upload_status: MediaUploadStatus.PENDING,
          upload_completed_at: null,
          retry_count: 0,
        });
        const saveResult = await this.propertyAttachedRepository.save(propertyAttached);
        const savedAttached = Array.isArray(saveResult) ? saveResult[0] : saveResult;
        savedAttachedList.push(savedAttached);

        // Si tiene URL, procesar para descargar y subir a S3
        if (attachedData.file_url && attachedData.file_url.startsWith('http') && savedAttached.id) {
          setImmediate(() => {
            this._processAndUploadAttached(savedAttached.id!, savedProperty.id!, { originalUrl: attachedData.file_url! });
          });
        }
      }

      console.log(`📁 create - Queued ${savedAttachedList.length} attached files for processing`);
    }

    // 4. Retornar la propiedad con todas sus relaciones cargadas
    const result = await this.findOne(savedProperty.id!);
    return warnings.length > 0 ? { data: result, warnings } : { data: result };
  }

  /**
   * Guarda multimedia para una propiedad específica
   * 
   * @param propertyId ID de la propiedad
   * @param saveMultimediaDto Metadatos de multimedia (videos, tours 360, orden de archivos)
   * @param files Archivos subidos (imágenes y adjuntos)
   * @returns Resultado del proceso con contadores de elementos procesados
   */
  async saveMultimedia(
    propertyId: number,
    saveMultimediaDto: SaveMultimediaDto,
    files?: { images?: Express.Multer.File[]; attached?: Express.Multer.File[] },
  ) {
    const safeFiles = files ?? {};
    const logContext = { propertyId, operation: 'saveMultimedia' };
    console.log('🚀 Starting multimedia save process', logContext);
    
    // Validar que la propiedad existe
    const property = await this.findOne(propertyId);
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    // Desestructurar datos del DTO (con fallback a objeto vacío si el DTO es undefined)
    const { videos: rawVideos, multimedia360: rawMultimedia360, images: rawImagesData, attached: rawAttachedData } = saveMultimediaDto || {};

    // Normalizar: cualquier valor no-array se convierte en []
    // Esto garantiza que campos ausentes (undefined), vacíos ({}) o [] siempre
    // resulten en un array, lo que borra los registros existentes no referenciados.
    const toArray = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
    const videos = toArray(rawVideos);
    const multimedia360 = toArray(rawMultimedia360);
    const imagesData = toArray(rawImagesData);
    const attachedData = toArray(rawAttachedData);

    // Logging estructurado de entrada
    const inputSummary = {
      videos: videos?.length || 0,
      multimedia360: multimedia360?.length || 0,
      imageMetadata: imagesData?.length || 0,
      imageFiles: safeFiles.images?.length || 0,
      attachedMetadata: attachedData?.length || 0,
      attachedFiles: safeFiles.attached?.length || 0,
    };
    console.log('📊 Input data summary:', inputSummary);

    // Usar transacción para operaciones atómicas
    return await this.dataSource.transaction(async (manager) => {
      const results = {
        videos: { processed: 0, errors: 0 },
        multimedia360: { processed: 0, errors: 0 },
        images: { queued: 0, errors: 0 },
        attached: { queued: 0, errors: 0 }
      };

      // 1. Procesar Videos (URLs externas) - Sincronizar con array recibido
      // Array vacío = eliminar todos los existentes
      {
        console.log(`🎥 Processing ${videos.length} video URLs`);
        try {
          // Obtener videos existentes
          const existingVideos = await manager.find(PropertyVideo, { where: { property: { id: propertyId }, is_360: false } });
          console.log(`📦 Found ${existingVideos.length} existing videos in DB`);

          const finalVideos: PropertyVideo[] = [];

          for (let idx = 0; idx < videos.length; idx++) {
            const url = videos[idx];
            const order = idx + 1;

            const found = existingVideos.find(v => v.url === url);
            if (found) {
              if (found.order !== order) {
                await manager.update(PropertyVideo, { id: found.id }, { order });
                found.order = order;
              }
              finalVideos.push(found);
            } else {
              const newVideo = manager.create(PropertyVideo, { url, property, is_360: false, order });
              const saved = await manager.save(PropertyVideo, newVideo);
              finalVideos.push(saved as PropertyVideo);
            }
            results.videos.processed++;
          }

          // Eliminar videos no presentes en metadata
          const idsToKeep = finalVideos.map(v => v.id);
          const toRemove = existingVideos.filter(v => !idsToKeep.includes(v.id));
          if (toRemove.length > 0) {
            const removeIds = toRemove.map(v => v.id);
            await manager.delete(PropertyVideo, removeIds);
            console.log(`🗑️ Removed ${removeIds.length} videos no longer referenced`);
          }

          console.log(`✅ Successfully processed ${results.videos.processed} videos`);
        } catch (error) {
          console.error('❌ Error processing videos:', error instanceof Error ? error.message : JSON.stringify(error));
          results.videos.errors++;
          throw error;
        }
      }

      // 2. Procesar Multimedia 360 (URLs externas) - Sincronizar con array recibido
      // Array vacío = eliminar todos los existentes
      {
        console.log(`🌐 Processing ${multimedia360.length} multimedia360 URLs`);
        try {
          // Obtener multimedia360 existentes
          const existingMultimedia360 = await manager.find(PropertyVideo, { where: { property: { id: propertyId }, is_360: true } });
          console.log(`📦 Found ${existingMultimedia360.length} existing multimedia360 in DB`);

          const finalMultimedia360: PropertyVideo[] = [];

          for (let idx = 0; idx < multimedia360.length; idx++) {
            const url = multimedia360[idx];
            const order = idx + 1;

            const found = existingMultimedia360.find(v => v.url === url);
            if (found) {
              if (found.order !== order) {
                await manager.update(PropertyVideo, { id: found.id }, { order });
                found.order = order;
              }
              finalMultimedia360.push(found);
            } else {
              const newVideo360 = manager.create(PropertyVideo, { url, property, is_360: true, order });
              const saved = await manager.save(PropertyVideo, newVideo360);
              finalMultimedia360.push(saved as PropertyVideo);
            }
            results.multimedia360.processed++;
          }

          // Eliminar multimedia360 no presentes en metadata
          const idsToKeep = finalMultimedia360.map(v => v.id);
          const toRemove = existingMultimedia360.filter(v => !idsToKeep.includes(v.id));
          if (toRemove.length > 0) {
            const removeIds = toRemove.map(v => v.id);
            await manager.delete(PropertyVideo, removeIds);
            console.log(`🗑️ Removed ${removeIds.length} multimedia360 no longer referenced`);
          }

          console.log(`✅ Successfully processed ${results.multimedia360.processed} multimedia360`);
        } catch (error) {
          console.error('❌ Error processing multimedia360:', error instanceof Error ? error.message : JSON.stringify(error));
          results.multimedia360.errors++;
          throw error;
        }
      }

      // 3. Procesar Imágenes - Transacción atómica
      // Sincronizar con array recibido + archivos nuevos.
      // Array vacío sin archivos = eliminar todas las existentes.
      {
        console.log(`🖼️ Processing images (metadata entries: ${imagesData?.length || 0}, files: ${safeFiles.images?.length || 0})`);

        // primero, obtener imágenes ya guardadas en la base
        const existingImages = await manager.find(PropertyImage, { where: { property: { id: propertyId } } });
        console.log(`📦 Found ${existingImages.length} existing images in DB`);

        // estructura auxiliar para manejar el flujo
        const finalImages: { entity: PropertyImage; order_position: number }[] = [];
        const filesToUpload: { entity: PropertyImage; file: Express.Multer.File }[] = [];
        const urlsToDownload: { imageId: number; originalUrl: string }[] = [];

        // función auxiliar para saber si una url apunta a nuestro bucket/properties
        const isOwnS3Url = (url: string): boolean => {
          try {
            return url.includes(`properties/${propertyId}`);
          } catch {
            return false;
          }
        };

        // 1. Procesar URLs de imágenes existentes (array de strings)
        for (let idx = 0; idx < imagesData.length; idx++) {
          const url = imagesData[idx];
          const order = idx + 1;

          const found = existingImages.find(img => img.url === url);
          if (found) {
            if (found.order_position !== order) {
              await manager.update(PropertyImage, { id: found.id }, { order_position: order });
              found.order_position = order;
            }
            finalImages.push({ entity: found, order_position: order });
          } else if (isOwnS3Url(url)) {
            // URL propia de S3 no registrada en DB → registrar como completada
            const newImg = manager.create(PropertyImage, {
              property,
              order_position: order,
              url,
              upload_status: MediaUploadStatus.COMPLETED,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyImage, newImg);
            finalImages.push({ entity: saved as PropertyImage, order_position: order });
          } else {
            // URL externa → descargar y subir a S3
            const newImg = manager.create(PropertyImage, {
              property,
              order_position: order,
              url: '',
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyImage, newImg);
            finalImages.push({ entity: saved as PropertyImage, order_position: order });
            urlsToDownload.push({ imageId: saved.id!, originalUrl: url });
            results.images.queued++;
          }
        }

        // 2. Procesar archivos nuevos (el orden continúa después de las URLs)
        if (safeFiles.images && safeFiles.images.length > 0) {
          for (const file of safeFiles.images) {
            const order = finalImages.length + 1;
            const newImg = manager.create(PropertyImage, {
              property,
              order_position: order,
              url: null,
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyImage, newImg);
            finalImages.push({ entity: saved as PropertyImage, order_position: order });
            filesToUpload.push({ entity: saved as PropertyImage, file });
            results.images.queued++;
          }
        }

        // eliminar imágenes antiguas que no aparecen en finalImages
        const idsToKeep = finalImages.map(f => f.entity.id);
        const toRemove = existingImages.filter(img => !idsToKeep.includes(img.id));
        if (toRemove.length > 0) {
          const removeIds = toRemove.map(i => i.id);
          await manager.delete(PropertyImage, removeIds);
          console.log(`🗑️ Removed ${removeIds.length} images no longer referenced`);
        }

        // lanzar carga en background sólo para las nuevas imágenes
        if (filesToUpload.length > 0) {
          const imgs = filesToUpload.map(i => i.entity);
          const fs = filesToUpload.map(i => i.file);
          setImmediate(() => {
            console.log(`🚀 Starting background image upload for ${imgs.length} new images (file payloads)`);
            this.processAndUploadUploadedFiles(imgs, fs, propertyId);
          });
        }

        if (urlsToDownload.length > 0) {
          const imagesToProcess = urlsToDownload.map(u => ({
            imageId: u.imageId,
            originalUrl: u.originalUrl,
            propertyId,
          }));
          setImmediate(() => {
            console.log(`🚀 Starting background image download for ${urlsToDownload.length} URL images`);
            this.processAndUploadImages(imagesToProcess);
          });
        }

        console.log(`✅ Image processing finished, queued ${results.images.queued}`);
      }

      // 4. Procesar Archivos Adjuntos - Sincronizar con array recibido + archivos nuevos.
      // Array vacío sin archivos = eliminar todos los existentes.
      {
        console.log(`📎 Processing attached files (metadata entries: ${attachedData?.length || 0}, files: ${safeFiles.attached?.length || 0})`);

        // Obtener archivos adjuntos ya guardados en la base
        const existingAttached = await manager.find(PropertyAttached, { where: { property: { id: propertyId } } });
        console.log(`📦 Found ${existingAttached.length} existing attached files in DB`);

        // Estructura auxiliar para manejar el flujo
        const finalAttached: { entity: PropertyAttached; order: number }[] = [];
        const filesToUpload: { entity: PropertyAttached; file: Express.Multer.File }[] = [];
        const urlsToDownload: { attachedId: number; originalUrl: string }[] = [];

        // Función auxiliar para saber si una url apunta a nuestro bucket/properties
        const isOwnS3Url = (url: string): boolean => {
          try {
            return url.includes(`properties/${propertyId}/attached/`);
          } catch {
            return false;
          }
        };

        // 1. Procesar URLs de adjuntos existentes (array de strings)
        for (let idx = 0; idx < attachedData.length; idx++) {
          const fileUrl = attachedData[idx];
          const order = idx + 1;

          const found = existingAttached.find(att => att.file_url === fileUrl);
          if (found) {
            if (found.order !== order) {
              await manager.update(PropertyAttached, { id: found.id }, { order });
              found.order = order;
            }
            finalAttached.push({ entity: found, order });
          } else if (isOwnS3Url(fileUrl)) {
            // URL propia de S3 no registrada en DB → registrar como completada
            const newAtt = manager.create(PropertyAttached, {
              property,
              order,
              description: `Documento ${order}`,
              file_url: fileUrl,
              upload_status: MediaUploadStatus.COMPLETED,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, newAtt);
            finalAttached.push({ entity: saved as PropertyAttached, order });
          } else {
            // URL externa → descargar y subir a S3
            const newAtt = manager.create(PropertyAttached, {
              property,
              order,
              description: `Documento ${order}`,
              file_url: '',
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, newAtt);
            finalAttached.push({ entity: saved as PropertyAttached, order });
            urlsToDownload.push({ attachedId: saved.id!, originalUrl: fileUrl });
            results.attached.queued++;
          }
        }

        // 2. Procesar archivos nuevos (el orden continúa después de las URLs)
        if (safeFiles.attached && safeFiles.attached.length > 0) {
          for (const file of safeFiles.attached) {
            const order = finalAttached.length + 1;
            const newAtt = manager.create(PropertyAttached, {
              property,
              order,
              description: `Documento ${order}`,
              file_url: '',
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, newAtt);
            finalAttached.push({ entity: saved as PropertyAttached, order });
            filesToUpload.push({ entity: saved as PropertyAttached, file });
            results.attached.queued++;
          }
        }

        // Eliminar archivos adjuntos antiguos que no aparecen en finalAttached
        const idsToKeep = finalAttached.map(f => f.entity.id);
        const toRemove = existingAttached.filter(att => !idsToKeep.includes(att.id));
        if (toRemove.length > 0) {
          const removeIds = toRemove.map(i => i.id);
          await manager.delete(PropertyAttached, removeIds);
          console.log(`🗑️ Removed ${removeIds.length} attached files no longer referenced`);
        }

        // Lanzar carga en background solo para los nuevos archivos
        if (filesToUpload.length > 0) {
          const atts = filesToUpload.map(i => i.entity);
          const fs = filesToUpload.map(i => i.file);
          setImmediate(() => {
            console.log(`🚀 Starting background attached upload for ${atts.length} new files (file payloads)`);
            this.processAndUploadAttachedFiles(atts, fs, propertyId);
          });
        }

        if (urlsToDownload.length > 0) {
          // Para URLs externas, usar el método existente que descarga y sube
          for (const u of urlsToDownload) {
            setImmediate(() => {
              this._processAndUploadAttached(u.attachedId, propertyId, { originalUrl: u.originalUrl });
            });
          }
        }

        console.log(`✅ Attached processing finished, queued ${results.attached.queued}`);
      }

      // Respuesta final con resumen del procesamiento
      const totalProcessed = results.videos.processed + results.multimedia360.processed;
      const totalQueued = results.images.queued + results.attached.queued;
      const totalErrors = results.videos.errors + results.multimedia360.errors + 
                         results.images.errors + results.attached.errors;

      console.log('✅ Multimedia save process completed:', {
        ...logContext,
        summary: { totalProcessed, totalQueued, totalErrors },
        details: results
      });

      return { 
        message: totalErrors > 0 
          ? 'Multimedia procesado parcialmente. Algunos elementos tuvieron errores.' 
          : 'Multimedia guardado correctamente. Los archivos se están procesando en segundo plano.',
        summary: {
          processed: totalProcessed,
          queued: totalQueued,
          errors: totalErrors
        },
        details: results,
        uploadTrackingEnabled: true
      };
    });
  }

  private async processAndUploadAttachedFiles(
    savedAttached: PropertyAttached[],
    files: Express.Multer.File[],
    propertyId: number,
  ) {
    const uploadPromises = [];

    for (let i = 0; i < savedAttached.length; i++) {
        const attached = savedAttached[i];
        const file = files[i];

        // Si el adjunto ya tiene una URL pero no hay archivo, procesarlo como URL
        if (attached.file_url && attached.file_url.startsWith('http') && !file) {
          uploadPromises.push(
            this._processAndUploadAttached(attached.id, propertyId, { originalUrl: attached.file_url! })
          );
          continue;
        }

        if (!file) continue;

        const uploadPromise = (async () => {
          try {
              await this.propertyAttachedRepository.update(attached.id, { 
                upload_status: MediaUploadStatus.UPLOADING 
              });

              const cleanFilename = this.cleanFilenameForUrl(file.originalname, attached.id);
              const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/attached`, cleanFilename);

              await this.mediaService.uploadFile(file.buffer, s3Key, file.mimetype);
              await this.propertyAttachedRepository.update(attached.id, {
                file_url: s3Key,
                upload_status: MediaUploadStatus.COMPLETED,
                upload_completed_at: new Date(),
                error_message: null,
              });

              console.log(`Successfully uploaded attached file: ${attached.id}`);
          } catch (error) {
              await this.handleUploadError(
                this.propertyAttachedRepository,
                attached.id,
                error,
                'Failed to upload attached file'
              );

              const isCircuitBreakerError = error instanceof Error && error.message.includes('Circuit Breaker');
              if (isCircuitBreakerError) {
                const currentAttached = await this.propertyAttachedRepository.findOne({ where: { id: attached.id } });
                if (currentAttached && currentAttached.retry_count < 3) {
                  setTimeout(() => {
                    this.retryAttachedUpload(attached.id, file, propertyId);
                  }, 60000);
                }
              }
          }
        })();

        uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);
  }

  /**
   * Reintentar upload de un archivo adjunto específico
   */
  private async retryAttachedUpload(attachedId: number, file: Express.Multer.File, propertyId: number) {
    try {
      await this.propertyAttachedRepository.update(attachedId, { 
        upload_status: MediaUploadStatus.UPLOADING,
        error_message: null,
      });

      const cleanFilename = this.cleanFilenameForUrl(file.originalname, attachedId);
      const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/attached`, cleanFilename);

      await this.mediaService.uploadFile(file.buffer, s3Key, file.mimetype);
      await this.propertyAttachedRepository.update(attachedId, {
        file_url: s3Key,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      console.log(`Successfully retried attached file upload: ${attachedId}`);
    } catch (error) {
      await this.handleUploadError(
        this.propertyAttachedRepository,
        attachedId,
        error,
        'Retry failed for attached file'
      );
    }
  }

  /**
   * Búsqueda avanzada de propiedades con múltiples filtros.
   * Usa QueryBuilder con parámetros parametrizados para máxima performance.
   */
  async searchProperties(
    filters: SearchPropertiesDto,
  ): Promise<{ 
    data: Property[]; 
    total: number; 
    page: number; 
    limit: number;
    mapData: Array<{ id: number; lat: number; lng: number; price?: number; reference_code: string }>;
    filterStats: {
      priceRanges: Array<{ min: number; max: number; count: number }>;
      totalProperties: number;
      minPrice: number;
      maxPrice: number;
    };
  }> {
    const limit = filters.limit ?? 20;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const qb = this.buildAdvancedSearchQuery(filters);

    // Datos paginados
    qb.orderBy('p.created_at', 'DESC').skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();

    // Datos para el mapa (todas las propiedades que coinciden, solo coordenadas)
    const mapQb = this.buildAdvancedSearchQuery(filters);
    const mapData = await mapQb
      .select(['p.id', 'p.geo_lat', 'p.geo_long', 'p.price', 'p.reference_code'])
      .andWhere('p.geo_lat IS NOT NULL')
      .andWhere('p.geo_long IS NOT NULL')
      .getRawMany()
      .then(results => 
        results.map(r => ({
          id: r.p_id,
          lat: parseFloat(r.p_geo_lat),
          lng: parseFloat(r.p_geo_long),
          price: r.p_price,
          reference_code: r.p_reference_code,
        }))
      );

    // Estadísticas para filtros
    const filterStats = await this.generateFilterStats(filters);

    return { 
      data, 
      total, 
      page, 
      limit,
      mapData,
      filterStats
    };
  }

  async searchPanelProperties(
    filters: SearchPropertiesDto,
    organizationId: number,
  ): Promise<{ data: Property[]; total: number; page: number; limit: number }> {
    const limit = filters.limit ?? 20;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    const qb = this.buildAdvancedSearchQuery(filters, {
      organizationId,
      includeStatusFilter: true,
    });

    qb.orderBy('p.created_at', 'DESC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Genera estadísticas para filtros (rangos de precios, conteos, etc.)
   */
  private async generateFilterStats(filters: SearchPropertiesDto) {
    const baseQb = this.buildAdvancedSearchQuery(filters);
    
    // Obtener min y max precios de todas las propiedades que coinciden
    const priceStats = await baseQb
      .select([
        'MIN(p.price) as minPrice',
        'MAX(p.price) as maxPrice',
        'COUNT(*) as totalProperties'
      ])
      .andWhere('p.price IS NOT NULL')
      .andWhere('p.price > 0')
      .getRawOne();

    const minPrice = parseFloat(priceStats.minPrice) || 0;
    const maxPrice = parseFloat(priceStats.maxPrice) || 0;
    const totalProperties = parseInt(priceStats.totalProperties) || 0;

    // Generar rangos de precios dinámicos
    const priceRanges = [];
    if (maxPrice > 0) {
      const rangeSize = (maxPrice - minPrice) / 10; // 10 rangos
      
      for (let i = 0; i < 10; i++) {
        const rangeMin = minPrice + (i * rangeSize);
        const rangeMax = i === 9 ? maxPrice : minPrice + ((i + 1) * rangeSize);
        
        const rangeQb = this.buildAdvancedSearchQuery(filters);
        const count = await rangeQb
          .andWhere('p.price >= :rangeMin', { rangeMin })
          .andWhere('p.price < :rangeMax', { rangeMax })
          .getCount();

        priceRanges.push({
          min: Math.round(rangeMin),
          max: Math.round(rangeMax),
          count
        });
      }
    }

    return {
      priceRanges,
      totalProperties,
      minPrice: Math.round(minPrice),
      maxPrice: Math.round(maxPrice)
    };
  }

  /**
   * Obtener todas las propiedades (no eliminadas)
   */
  async findAll(
    skip: number = 0,
    take: number = 10,
    filters?: {
      property_type?: number;
      status?: number;
      city?: string;
      min_price?: number;
      max_price?: number;
      organization_id?: number;
    },
  ): Promise<{ data: Property[]; total: number }> {
    const query = this.propertyRepository
      .createQueryBuilder('property')
      .where('property.deleted = :deleted', { deleted: false });

    // Aplicar filtros opcionales
    if (filters?.property_type) {
      query.andWhere('property.property_type = :property_type', {
        property_type: filters.property_type,
      });
    }

    if (filters?.status) {
      query.andWhere('property.status = :status', { status: filters.status });
    }

    if (filters?.min_price) {
      query.andWhere('property.price >= :min_price', {
        min_price: filters.min_price,
      });
    }

    if (filters?.max_price) {
      query.andWhere('property.price <= :max_price', {
        max_price: filters.max_price,
      });
    }

    if (filters?.organization_id) {
      query.andWhere('property.organization_id = :organization_id', {
        organization_id: filters.organization_id,
      });
    }

    const [data, total] = await query
      .orderBy('property.created_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * Obtener una propiedad por ID
   */
  async findOne(id: number): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: {
        id,
        deleted: false,
      },
      relations: ['images', 'attributes', 'tags', 'videos', 'attached'],
    });

    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${id} no encontrada`);
    }

    return property;
  }

  /**
   * Obtener una propiedad por reference_code
   */
  async findByReferenceCode(reference_code: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: {
        reference_code,
        deleted: false,
      },
      relations: ['images', 'attributes', 'tags', 'videos', 'attached'],
    });

    if (!property) {
      throw new NotFoundException(
        `Propiedad con código ${reference_code} no encontrada`,
      );
    }

    return property;
  }

  /**
   * Actualizar una propiedad
   */
  async update(
    id: number,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<{ data: Property; warnings?: string[] }> {
    const { tags, ...propertyData } = updatePropertyDto;
    const property = await this.findOne(id);

    // Verificar si se está intentando cambiar el reference_code a uno que ya existe
    if (
      updatePropertyDto.reference_code &&
      updatePropertyDto.reference_code !== property.reference_code
    ) {
      const existingProperty = await this.propertyRepository.findOne({
        where: { reference_code: updatePropertyDto.reference_code },
      });

      if (existingProperty) {
        throw new BadRequestException(
          'Una propiedad con este código de referencia ya existe',
        );
      }
    }

    const { warnings } = await this.propertyWriteService.updatePropertyCore(
      property,
      propertyData,
      { tags },
    );

    const result = await this.findOne(id);
    return warnings.length > 0 ? { data: result, warnings } : { data: result };
  }

  /**
   * Eliminar lógico (soft delete) - marcar como eliminado
   */
  async remove(id: number): Promise<{ message: string }> {
    const property = await this.findOne(id);

    property.deleted = true;
    property.deleted_at = new Date();

    await this.propertyRepository.save(property);

    return { message: `Propiedad ${id} eliminada correctamente` };
  }

  /**
   * Buscar propiedades por criterios
   */
  async search(query: string): Promise<Property[]> {
    return this.propertyRepository
      .createQueryBuilder('property')
      .where('property.deleted = :deleted', { deleted: false })
      .andWhere(
        '(property.publication_title ILIKE :query OR property.street ILIKE :query OR property.reference_code ILIKE :query)',
        { query: `%${query}%` },
      )
      .orderBy('property.created_at', 'DESC')
      .take(20)
      .getMany();
  }

  /**
   * Obtener toda la multimedia de una propiedad (imágenes, videos, videos 360, adjuntos)
   */
  async getMultimedia(propertyId: number) {
    const property = await this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.images', 'image')
      .leftJoinAndSelect('property.videos', 'video')
      .leftJoinAndSelect('property.attached', 'attached')
      .where('property.id = :id', { id: propertyId })
      .andWhere('property.deleted = :deleted', { deleted: false })
      .orderBy('image.order_position', 'ASC')
      .addOrderBy('video.order', 'ASC')
      .addOrderBy('attached.order', 'ASC')
      .getOne();

    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    const allVideos = property.videos ?? [];

    return {
      images: property.images ?? [],
      videos: allVideos.filter(v => !v.is_360),
      videos360: allVideos.filter(v => v.is_360),
      attached: property.attached ?? [],
    };
  }

  /**
   * Reintentar uploads fallidos para una propiedad
   */
  async retryFailedUploads(propertyId: number) {
    const property = await this.findOne(propertyId);
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    // Obtener imágenes fallidas
    const failedImages = await this.propertyImageRepository.find({
      where: { 
        property: { id: propertyId },
        upload_status: MediaUploadStatus.FAILED
      }
    });

    // Obtener archivos adjuntos fallidos
    const failedAttached = await this.propertyAttachedRepository.find({
      where: { 
        property: { id: propertyId },
        upload_status: MediaUploadStatus.FAILED
      }
    });

    const retryResults = {
      images: { queued: 0, skipped: 0 },
      attached: { queued: 0, skipped: 0 }
    };

    // Reintentar imágenes
    for (const image of failedImages) {
      if (image.retry_count < 3) {
        await this.propertyImageRepository.update(image.id, {
          upload_status: MediaUploadStatus.RETRYING,
          error_message: null
        });
        
        // Solo reintentamos si tenemos la URL original guardada
        if (image.url && image.url.startsWith('http')) {
          setImmediate(() => {
            this._processAndUploadImage(image.id, propertyId, { originalUrl: image.url! });
          });
          retryResults.images.queued++;
        } else {
          retryResults.images.skipped++;
        }
      } else {
        retryResults.images.skipped++;
      }
    }

    // Reintentar archivos adjuntos
    for (const attached of failedAttached) {
      if (attached.retry_count < 3) {
        await this.propertyAttachedRepository.update(attached.id, {
          upload_status: MediaUploadStatus.RETRYING,
          error_message: null
        });
        
        // Solo reintentamos si tenemos la URL original guardada
        if (attached.file_url && attached.file_url.startsWith('http')) {
          setImmediate(() => {
            this._processAndUploadAttached(attached.id, propertyId, { originalUrl: attached.file_url! });
          });
          retryResults.attached.queued++;
        } else {
          retryResults.attached.skipped++;
        }
      } else {
        retryResults.attached.skipped++;
      }
    }

    return {
      message: 'Reintento de uploads iniciado',
      results: retryResults
    };
  }

  /**
   * Obtener estado del servicio S3 y circuit breaker
   */
  async getS3ServiceStatus() {
    const healthCheck = await this.mediaService.getS3Status();
    return {
      ...healthCheck,
      timestamp: new Date(),
      recommendations: this.getServiceRecommendations(healthCheck)
    };
  }

  /**
   * Helper para generar recomendaciones basadas en el estado del servicio
   */
  private getServiceRecommendations(healthCheck: any) {
    const recommendations = [];
    
    if (healthCheck.status === 'unhealthy') {
      recommendations.push('Verificar conectividad de red y credenciales AWS');
    }
    
    const circuitState = healthCheck.circuitBreaker?.state;
    if (circuitState === 'open') {
      recommendations.push('Circuit breaker abierto: S3 temporalmente no disponible, los uploads se reintentarán automáticamente');
    } else if (circuitState === 'half-open') {
      recommendations.push('Circuit breaker probando recuperación del servicio S3');
    }
    
    if (healthCheck.circuitBreaker?.failureCount > 0) {
      recommendations.push(`${healthCheck.circuitBreaker.failureCount} fallas recientes detectadas en S3`);
    }
    
    return recommendations;
  }

  // =============================================
  // MULTIMEDIA UPLOAD HELPERS
  // =============================================

  /**
   * Limpiar nombre de archivo adjunto para que sea seguro para URL y único.
   * Específico para la convención de naming de adjuntos de propiedades.
   */
  private cleanFilenameForUrl(originalFilename: string, entityId: number): string {
    const sanitizedBasename = sanitizeFilename(originalFilename);
    const extension = getFileExtension(originalFilename);
    return createUniqueFilename(sanitizedBasename, entityId, extension);
  }

  /**
   * Manejo consistente de errores de upload: actualiza status y conteo de reintentos en DB.
   */
  private async handleUploadError<T extends Record<string, any>>(
    repository: Repository<T>,
    entityId: number,
    error: any,
    contextInfo: string
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message.substring(0, 1000) : 'Upload failed';
    const isCircuitBreakerError = error instanceof Error && error.message.includes('Circuit Breaker');
    
    const updateData = {
      upload_status: isCircuitBreakerError ? MediaUploadStatus.RETRYING : MediaUploadStatus.FAILED,
      error_message: errorMsg
    } as any;
    
    await repository.update(entityId, updateData);
    await repository.increment({ id: entityId } as any, 'retry_count', 1);
    
    console.error(`${contextInfo} ID ${entityId}:`, error);
  }

  // =============================================
  // END MULTIMEDIA UPLOAD HELPERS
  // =============================================

  /**
   * Sube una imagen de propiedad a S3 con la estructura correcta: properties/{propertyId}/images/{filename}
   */
  async uploadImageToS3(file: Express.Multer.File, imageId: number, propertyId: number): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const filename = `${imageId}-${timestamp}.${fileExtension}`;
      const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/images`, filename);

      await this.mediaService.uploadFile(file.buffer, s3Key, file.mimetype);
      await this.propertyImageRepository.update(imageId, {
        url: s3Key,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      return s3Key;
    } catch (error) {
      await this.handleUploadError(
        this.propertyImageRepository,
        imageId,
        error,
        'Failed to upload image'
      );
      return null;
    }
  }

  /**
   * Procesa y sube imágenes a S3 en segundo plano desde URLs originales (usado en create process).
   * Descarga la imagen de la URL original, la sube a S3 y actualiza la DB.
   */
  private async processAndUploadImages(
    imagesToProcess: {
      imageId: number;
      originalUrl: string;
      propertyId: number;
    }[],
  ) {
    for (const image of imagesToProcess) {
      await this._processAndUploadImage(image.imageId, image.propertyId, {
        originalUrl: image.originalUrl,
      });
    }
  }

  /**
   * Procesa y sube archivos recibidos por file upload a S3 en segundo plano.
   * Actualiza la url y el status en la base.
   */
  private async processAndUploadUploadedFiles(
    savedImages: PropertyImage[],
    files: Express.Multer.File[],
    propertyId: number,
  ) {
    // Procesar uploads en paralelo para mejor rendimiento
    const uploadPromises = savedImages.map((image, index) => {
      const file = files[index];
      return this._processAndUploadImage(image.id, propertyId, { file });
    });

    // Ejecutar todas las subidas en paralelo
    await Promise.all(uploadPromises);
  }

  /**
   * Procesa y sube una imagen a S3, actualizando la base de datos.
   * Delega la compresión y el upload multi-tamaño a MediaService.
   * Solo almacena en DB la URL del tamaño FULL; el thumb se deriva
   * anteponiendo THUMB_PREFIX al nombre del archivo.
   */
  private async _processAndUploadImage(
    imageId: number,
    propertyId: number,
    imageSource: { file?: Express.Multer.File; originalUrl?: string },
  ) {
    try {
      await this.propertyImageRepository.update(imageId, {
        upload_status: MediaUploadStatus.UPLOADING,
      });

      const folder = `properties/${propertyId}/images`;
      const keys = await this.mediaService.uploadImageWithSizes(imageSource, folder, imageId);

      const fullKey = keys['FULL'];
      if (!fullKey) throw new Error('FULL size upload did not produce a key');

      await this.propertyImageRepository.update(imageId, {
        url: fullKey,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      console.log(`Successfully processed all sizes for image: ${imageId}`);
    } catch (error) {
      const err: any = error;
      let errorMsg = 'Unknown error';

      if (err?.code === 'ENOTFOUND') {
        errorMsg = `URL not found: ${imageSource.originalUrl}`;
      } else if (err?.response?.status) {
        errorMsg = `HTTP ${err.response.status}: ${imageSource.originalUrl}`;
      } else if (err?.message) {
        errorMsg = `Error: ${err.message.substring(0, 100)}`;
      } else {
        errorMsg = `Processing failed for image ID: ${imageId}`;
      }

      errorMsg = errorMsg.substring(0, 1000);

      const isCircuitBreakerError = err instanceof Error && err.message.includes('Circuit Breaker');
      const errorStatus = isCircuitBreakerError ? MediaUploadStatus.RETRYING : MediaUploadStatus.FAILED;

      await this.propertyImageRepository.update(imageId, {
        upload_status: errorStatus,
        error_message: errorMsg,
      });
      await this.propertyImageRepository.increment({ id: imageId }, 'retry_count', 1);

      console.error(`Failed to process image ID ${imageId}:`, err?.message || error);

      if (isCircuitBreakerError && imageSource.originalUrl) {
        const currentImage = await this.propertyImageRepository.findOne({ where: { id: imageId } });
        if (currentImage && currentImage.retry_count < 3) {
          setTimeout(() => {
            this._processAndUploadImage(imageId, propertyId, imageSource);
          }, 60000);
        }
      }
    }
  }

  /**
   * Procesar y subir archivo adjunto (privado).
   * Delega la descarga desde URL y el upload a MediaService.
   */
  private async _processAndUploadAttached(
    attachedId: number,
    propertyId: number,
    attachedSource: { file?: Express.Multer.File; originalUrl?: string },
  ) {
    try {
      await this.propertyAttachedRepository.update(attachedId, { 
        upload_status: MediaUploadStatus.UPLOADING,
        error_message: null,
      });

      let fileBuffer: Buffer;
      let filename: string;
      let mimetype: string;

      if (attachedSource.originalUrl) {
        ({ buffer: fileBuffer, filename, mimetype } = await this.mediaService.downloadFromUrl(attachedSource.originalUrl));
      } else if (attachedSource.file) {
        fileBuffer = attachedSource.file.buffer;
        filename = attachedSource.file.originalname;
        mimetype = attachedSource.file.mimetype;
      } else {
        throw new Error('No file source provided');
      }

      const cleanFilename = this.cleanFilenameForUrl(filename, attachedId);
      const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/attached`, cleanFilename);

      await this.mediaService.uploadFile(fileBuffer, s3Key, mimetype);
      await this.propertyAttachedRepository.update(attachedId, {
        file_url: s3Key,
        upload_status: MediaUploadStatus.COMPLETED,
        upload_completed_at: new Date(),
        error_message: null,
      });

      console.log(`Successfully processed attached file: ${attachedId}`);
    } catch (error) {
      let contextInfo = 'Failed to process attached file';
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          contextInfo = `URL not found: ${attachedSource.originalUrl}`;
        } else if (error.response?.status) {
          contextInfo = `HTTP ${error.response.status}: ${attachedSource.originalUrl}`;
        } else {
          contextInfo = error.message || 'Network error downloading file';
        }
      }

      await this.handleUploadError(
        this.propertyAttachedRepository,
        attachedId,
        error,
        contextInfo
      );

      const isCircuitBreakerError = error instanceof Error && error.message.includes('Circuit Breaker');
      if (isCircuitBreakerError && attachedSource.originalUrl) {
        const currentAttached = await this.propertyAttachedRepository.findOne({ where: { id: attachedId } });
        if (currentAttached && currentAttached.retry_count < 3) {
          setTimeout(() => {
            this._processAndUploadAttached(attachedId, propertyId, attachedSource);
          }, 60000);
        }
      }
    }
  }
}