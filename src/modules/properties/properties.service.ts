import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyWriteService } from './property-write.service';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { prependImagePrefixToUrls } from './helpers/properties-helper';

import { MediaService } from '../../common/media/media.service';
import { PropertyVideo } from './entities/property-video.entity';
import { PropertyAttached } from './entities/property-attached.entity';
import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { sanitizeFilename, getFileExtension, createUniqueFilename } from '../../common/helpers/file-helpers';

import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import {
  PropertyStatus,
  MediaUploadStatus,
  Currency,
  PropertyType,
} from '../../common/enums';
import { CreateDevelopmentDto } from './dto/create-development.dto';
import { UpdateDevelopmentDto } from './dto/update-development.dto';
import { DataSource } from 'typeorm';
import { THUMB_PREFIX } from '@/common/constants';
import { accessSync } from 'fs';
import { filter } from 'rxjs';

export interface PropertyCard {
  id: number;
  publication_title: string;
  street?: string;
  total_surface?: number;
  room_amount?: number;
  bathroom_amount?: number;
  currency: Currency;
  price: number;
  price_square_meter?: number;
  images?: PropertyImage[];
  lat?: number;
  long?: number;
}

type PolygonPoint = {
  lat: number;
  lng: number;
};

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(PropertyImage)
    private propertyImageRepository: Repository<PropertyImage>,
    @InjectRepository(PropertyAttached)
    private propertyAttachedRepository: Repository<PropertyAttached>,
    private readonly mediaService: MediaService,
    private readonly dataSource: DataSource,
    private readonly propertyWriteService: PropertyWriteService,
  ) {}


  /**
   * Crea una propiedad en estado borrador.
   * Rellena los campos obligatorios con valores por defecto.
   */
  async createDraft(createDraftDto: CreateDraftPropertyDto): Promise<Property> {

    if(createDraftDto.organization_id == null) {
      createDraftDto.direct_owner = true; 
    }
    console.log("[PropertiesService.createDraft] createDraftDto:", JSON.stringify(createDraftDto, null, 2));

    return this.propertyRepository.save(createDraftDto);

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

    // DEBUG: Confirmar si entra realmente a este método
    console.log('[DEBUG][PropertiesService.create] Entró al método. propertyData:', JSON.stringify(propertyData, null, 2));

    // Verificar que no exista una propiedad con el mismo reference_code
    const existingProperty = await this.propertyRepository.findOne({
      where: { reference_code: propertyData.reference_code },
    });

    if (existingProperty) {
      throw new BadRequestException(
        'Una propiedad con este código de referencia ya existe',
      );
    }

    // Crear la propiedad base y sincronizar tags, videos, multimedia360, images y attached
    const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
      { ...propertyData, deleted: false },
      { tags, videos, multimedia360, images, attached },
    );

    this.logger.log('[PropertiesService.create] property después de salvar:', JSON.stringify(savedProperty, null, 2));

    // Retornar la propiedad con todas sus relaciones cargadas
    const result = await this.findOne(savedProperty.id!);
    this.logger.log('[PropertiesService.create] Propiedad creada (findOne):', JSON.stringify(result, null, 2));
    return warnings.length > 0 ? { data: result, warnings } : { data: result };
  }

  /**
   * Crea un emprendimiento (propiedad de tipo EMPRENDIMIENTO).
   * Toda la gestión de imágenes, tags, videos y adjuntos funciona igual que en create().
   */
  async createDevelopment(
    createDevelopmentDto: CreateDevelopmentDto,
  ): Promise<{ data: Property; warnings?: string[] }> {
    const { images, tags, videos, multimedia360, attached, ...propertyData } = createDevelopmentDto as any;

    const existingProperty = await this.propertyRepository.findOne({
      where: { reference_code: propertyData.reference_code },
    });
    if (existingProperty) {
      throw new BadRequestException('Una propiedad con este código de referencia ya existe');
    }

    const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
      {
        ...propertyData,
        is_development: true,
        property_type: PropertyType.EMPRENDIMIENTO,
        operation_type: propertyData.operation_type ?? 1,
        price: propertyData.price ?? 0,
        currency: propertyData.currency ?? Currency.USD,
        status: propertyData.status ?? PropertyStatus.DRAFT,
        deleted: false,
      },
      { tags, videos, multimedia360, images, attached },
    );

    const result = await this.findOne(savedProperty.id!);
    return warnings.length > 0 ? { data: result, warnings } : { data: result };
  }

  /**
   * Actualiza un emprendimiento existente.
   */
  async updateDevelopment(
    id: number,
    updateDevelopmentDto: UpdateDevelopmentDto,
  ): Promise<{ data: Property; warnings?: string[] }> {
    const { tags, ...propertyData } = updateDevelopmentDto;
    const property = await this.findOne(id);

    if (!property.is_development) {
      throw new BadRequestException('La propiedad especificada no es un emprendimiento');
    }

    if (
      updateDevelopmentDto.reference_code &&
      updateDevelopmentDto.reference_code !== property.reference_code
    ) {
      const existingProperty = await this.propertyRepository.findOne({
        where: { reference_code: updateDevelopmentDto.reference_code },
      });
      if (existingProperty) {
        throw new BadRequestException('Una propiedad con este código de referencia ya existe');
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
            // URL externa → guardar la URL; el cron la descargará y subirá a S3
            const newImg = manager.create(PropertyImage, {
              property,
              order_position: order,
              url: url,
              original_image: url,
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyImage, newImg);
            finalImages.push({ entity: saved as PropertyImage, order_position: order });
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

        // Función auxiliar para saber si una url apunta a nuestro bucket/properties
        const isOwnS3Url = (url: string): boolean => {
          try {
            return url.includes(`properties/${propertyId}/attached/`);
          } catch {
            return false;
          }
        };

        // 1. Procesar URLs de adjuntos existentes (array de strings)
        type AttachedInput = string | { file_url: string; original_file?: string; description?: string; order?: number };
        for (let idx = 0; idx < attachedData.length; idx++) {
          const attachedItem = attachedData[idx] as AttachedInput;
          // Permitir tanto string como objeto (retrocompatibilidad)
          let fileUrl: string;
          let originalUrl: string;
          if (typeof attachedItem === 'string') {
            fileUrl = attachedItem;
            originalUrl = attachedItem;
          } else {
            fileUrl = attachedItem.file_url;
            originalUrl = attachedItem.original_file ?? attachedItem.file_url;
          }
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
              original_file: originalUrl,
              upload_status: MediaUploadStatus.COMPLETED,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, newAtt);
            finalAttached.push({ entity: saved as PropertyAttached, order });
          } else {
            // URL externa → el cron la descarga y sube a S3
            const newAtt = manager.create(PropertyAttached, {
              property,
              order,
              description: `Documento ${order}`,
              file_url: fileUrl,
              original_file: originalUrl,
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, newAtt);
            finalAttached.push({ entity: saved as PropertyAttached, order });
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

  /**
   * Obtener una propiedad por ID
   */
  async findOne(id: number, format: string | null = null): Promise<Property> {
    console.log('[´properties.service] ID A BUSCAR', id);
    this.logger.log('[PropertiesService.findOne] Buscando propiedad con ID:', id, 'format:', format);

    let property: Property | null = null;
    console.log("[PropertiesService.findOne] ID recibido:", id, "Format recibido:", format);
    if (format === 'card') {
      // Usar QueryBuilder para traer campos seleccionados y la relación organization
      property = await this.propertyRepository.createQueryBuilder('property')
        .leftJoinAndSelect('property.organization', 'organization')
        .where('property.id = :id', { id })
        .andWhere('property.deleted = false')
        .select([
          'property.id',
          'property.price',
          'property.price_square_meter',
          'property.bathroom_amount',
          'property.street',
          'property.room_amount',
          'property.surface',
          'organization.company_name',
          'organization.company_logo',
        ])
        .getOne();

      // Traer solo la primera imagen (si existe)
      if (property) {
        let firstImage = await this.propertyImageRepository.findOne({
          where: { property: { id } },
          order: { order_position: 'ASC' },
        });
        if(firstImage) {
          property.images = prependImagePrefixToUrls(THUMB_PREFIX, [firstImage]);
        }
      }
      console.log("[PropertiesService.findOne] Resultado para formato 'marker':", JSON.stringify(property, null, 2));
    } else if (format === 'multimedia') {
      // Traer id, todas las imágenes, todos los videos y multimedia360
      property = await this.propertyRepository.findOne({
        where: {
          id,
          deleted: false,
        },
        select: ['id'],
        relations: ['images', 'videos'],
      });
      if (property) {
        // Separar videos y multimedia360
        const allVideos = property.videos ?? [];
        property.videos = allVideos.filter(v => !v.is_360);
        (property as any).multimedia360 = allVideos.filter(v => v.is_360);
      }
      console.log("[PropertiesService.findOne] Resultado para formato 'multimedia':", JSON.stringify(property, null, 2));

    } else {
      // DETALLE MAS COMPLETO DE LA PROPIEDAD
      property = await this.propertyRepository.createQueryBuilder('property')
        .leftJoinAndSelect('property.images', 'images')
        .leftJoinAndSelect('property.attributes', 'attributes')
        .leftJoinAndSelect('property.tags', 'tags')
        .leftJoinAndSelect('property.videos', 'videos')
        .leftJoinAndSelect('property.attached', 'attached')
        .leftJoinAndSelect('property.organization', 'organization')
        .where('property.id = :id', { id })
        .andWhere('property.deleted = false')
        .select([
          'property',
          'images',
          'attributes',
          'tags',
          'videos',
          'attached',
          'organization',
        ])
        .getOne();

      if (property?.images) {
        property.images = prependImagePrefixToUrls('', property.images);
      }

      // Buscar usuario relacionado si existe user_id
      if (property?.user_id && property.organization_id) {
        const userRepo = this.dataSource.getRepository('users');
        const user = await userRepo.findOne({
          where: {
            id: property.user_id,
            organization_id: property.organization_id,
            deleted: false,
          },
          select: ['id', 'name', 'email', 'phone'],
        });
        if (user) {
          (property as any).user = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
          };
        }
      }
    }

    this.logger.log('[PropertiesService.findOne] Resultado:', JSON.stringify(property, null, 2));

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
   * Reintentar uploads fallidos: resetea registros FAILED con URL a PENDING
   * para que el cron los recoja en el próximo ciclo (5 min imágenes, 10 min adjuntos).
   * Registros sin URL (subida de archivo fallida) no pueden re-intentarse.
   */
  async resetFailedUploads(propertyId: number) {
    await this.propertyImageRepository
      .createQueryBuilder()
      .update()
      .set({ upload_status: MediaUploadStatus.PENDING, retry_count: 0, error_message: null })
      .where('propertyId = :propertyId', { propertyId })
      .andWhere('upload_status = :status', { status: MediaUploadStatus.FAILED })
      .andWhere("url LIKE 'http%'")
      .execute();

    await this.propertyAttachedRepository
      .createQueryBuilder()
      .update()
      .set({ upload_status: MediaUploadStatus.PENDING, retry_count: 0, error_message: null })
      .where('propertyId = :propertyId', { propertyId })
      .andWhere('upload_status = :status', { status: MediaUploadStatus.FAILED })
      .andWhere("file_url LIKE 'http%'")
      .execute();

    return {
      message: 'Uploads fallidos re-encolados; serán procesados en el próximo ciclo del cron',
    };
  }

  // =============================================
  // SEARCH PROPERTIES
  // =============================================
  
  
  /**
   * Búsqueda avanzada de propiedades con múltiples filtros.
   * Usa QueryBuilder con parámetros parametrizados para máxima performance.
   */
  async searchProperties(
    filters: SearchPropertiesDto,
  ): Promise<{
    data: Property[] | PropertyCard[];
    total: number;
    page: number;
    limit: number;
    mapData: Array<{ id: number; lat: number; lng: number; price?: number; reference_code: string }>;
  }> {
    const limit = filters.limit ?? 20;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

    let data: Property[] | PropertyCard[] = [];
    let total = 0;

    const { qb: baseQb, orderBy, orderDirection } = await this.buildAdvancedSearchQuery(filters);

    if (filters.full) {
      // Modo full: query completa con todas las relaciones
      const qb = baseQb.clone();


      qb.leftJoinAndSelect('p.images', 'img')
        .leftJoinAndSelect('p.organization', 'p_org')
        .addOrderBy('img.order_position', 'ASC')
        .skip(offset)
        .take(limit)
        .orderBy(orderBy, orderDirection);
      [data, total] = await qb.getManyAndCount();
    } else {
      // Modo card: SELECT solo las columnas necesarias + join de imágenes y organización
      // No se cargan relaciones eager (attributes, tags, videos, attached)
      const cardQb = baseQb.clone()
        .select([
          'p.id',
          'p.publication_title',
          'p.street',
          'p.total_surface',
          'p.room_amount',
          'p.bathroom_amount',
          'p.currency',
          'p.price',
          'p.price_square_meter',
          'p.geo_lat',
          'p.geo_long',
          'p.created_at',
          'p_org.id',
          'p_org.company_name',
          'p_org.company_logo',
        ])
        .leftJoinAndSelect(
          'p.images',
          'img',
          `img.id = (
            SELECT pi.id
            FROM property_images pi
            WHERE pi."propertyId" = p.id
            ORDER BY COALESCE(pi.order_position, 2147483647) ASC, pi.id ASC
            LIMIT 1
          )`,
        )
        .leftJoinAndSelect('p.organization', 'p_org')
        .orderBy(orderBy, orderDirection)
        .skip(offset)
        .take(limit);

      const [partialProps, cardTotal] = await cardQb.getManyAndCount();
      total = cardTotal;
      data = partialProps.map((p) => ({
        id: p.id as number,
        publication_title: p.publication_title,
        street: p.street,
        total_surface: p.total_surface,
        room_amount: p.room_amount,
        bathroom_amount: p.bathroom_amount,
        currency: p.currency,
        price: p.price,
        price_square_meter: p.price_square_meter,
        images: p.images ? prependImagePrefixToUrls(THUMB_PREFIX, p.images) : [],
        lat: p.geo_lat,
        long: p.geo_long,
        organization: p.organization ? {
          id: p.organization.id,
          company_name: p.organization.company_name,
          company_logo: p.organization.company_logo,
        } : undefined,
      }));
    }

    // Datos para el mapa (todas las propiedades que coinciden, solo coordenadas)
    const mapData = await baseQb
      .select(['p.id', 'p.geo_lat', 'p.geo_long', 'p.price', 'p.price_square_meter', 'p.reference_code'])
      .andWhere('p.geo_lat IS NOT NULL')
      .andWhere('p.geo_long IS NOT NULL')
      .getRawMany()
      .then(results =>
        results.map(r => ({
          id: r.p_id,
          lat: parseFloat(r.p_geo_lat),
          lng: parseFloat(r.p_geo_long),
          price: r.p_price,
          price_square_meter: r.p_price_square_meter,
          reference_code: r.p_reference_code,
        }))
      );

    return {
      data,
      total,
      page,
      limit,
      mapData,
    };
  }

  async searchPanelProperties(
    filters: SearchPropertiesDto,
    organizationId: number,
  ): Promise<{ data: Property[]; total: number; page: number; limit: number }> {
    filters.limit = filters.limit ?? 20;
    filters.page = filters.page ?? 1; 

    const { qb } = await this.buildAdvancedSearchQuery(filters, {
      organizationId,
      includeStatusFilter: true,
    });

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page: filters.page, limit: filters.limit };
  }

  
  private async buildAdvancedSearchQuery(
    filters: SearchPropertiesDto,
    options?: {
      organizationId?: number;
      includeStatusFilter?: boolean;
    },
  ) {
    // Parse orderBy / orderDirection desde filters
    let orderBy = 'p.created_at';
    let orderDirection: 'ASC' | 'DESC' = 'ASC';
    if (filters.order_by) {
      let by: string | undefined, dir: string | undefined;
      if (filters.order_by.includes(':')) {
        [by, dir] = filters.order_by.split(':');
      } else if (filters.order_by.includes(' ')) {
        [by, dir] = filters.order_by.split(' ');
      } else {
        by = filters.order_by;
      }
      if (by) orderBy = by.startsWith('p.') ? by : `p.${by}`;
      if (dir) {
        const dirUpper = dir.toUpperCase();
        orderDirection = (dirUpper === 'ASC' || dirUpper === 'DESC') ? dirUpper : 'ASC';
      }
    }

    // Si se recibe location_id, buscar su tipo y asignar el filtro correcto
    if (filters.location_id != null) {
      if (
        filters.southWestLat == null && filters.southWestLng == null &&
        filters.northEastLat == null && filters.northEastLng == null &&
        filters.polygon == null
      ) {
        const locationRepo = this.dataSource.getRepository('locations');
        const location = await locationRepo.findOne({ where: { id: filters.location_id } });
        filters.location_id = undefined; // reset filtro para evitar una busqueda equivocada
        if (location) {
          if (location.type === 'country') {
            filters.country_id = location.id;
          } else if (location.type === 'state') {
            filters.state_id = location.id;
          } else if (location.type === 'location') {
            filters.location_id = location.id;
          } else if (location.type === 'sub_location') {
            filters.sub_location_id = location.id;
          }
        }
      }
    }

    const qb = this.propertyRepository
      .createQueryBuilder('p')
      .leftJoin('organizations', 'org', 'p.organization_id = org.id');

    // Traer propiedades de inmobiliarias activas Y propiedades de dueño directo
    qb.where('p.deleted = :deleted', { deleted: false })
      .andWhere('((p.organization_id IS NOT NULL AND org.status = :orgStatus AND org.deleted = :orgDeleted) OR (p.organization_id IS NULL AND p.direct_owner = true))', {
        orgStatus: true,
        orgDeleted: false,
      });

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

    if (options?.includeStatusFilter !== false) {
      // si incluye el filtro de status, aplicar el filtro recibido si existe sino traer todos los statuses (
      if (filters.status != null) {
        qb.andWhere('p.status = :status', { status: filters.status });
      }
    } else {
      qb.andWhere('p.status = :status', { status: PropertyStatus.DISPONIBLE });
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

    if (Array.isArray(filters.property_type) && filters.property_type.length > 0) {
      qb.andWhere('p.property_type IN (:...property_type)', {
        property_type: filters.property_type,
      });
    }

    // property subtype
    if (Array.isArray(filters.property_subtype) && filters.property_subtype.length > 0) {
      qb.andWhere('p.property_subtype IN (:...property_subtype)', {
        property_subtype: filters.property_subtype,
      });
    }


    if (Array.isArray(filters.operation_type) && filters.operation_type.length > 0) {
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

    if (filters.price_m2_min != null) {
      qb.andWhere('p.price_square_meter >= :price_m2_min', { price_m2_min: filters.price_m2_min });
    }

    if (filters.price_m2_max != null) {
      qb.andWhere('p.price_square_meter <= :price_m2_max', { price_m2_max: filters.price_m2_max });
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

    if (Array.isArray(filters.bathroom_amount) && filters.bathroom_amount.length > 0) {
      qb.andWhere('p.bathroom_amount IN (:...bathroom_amount)', {
        bathroom_amount: filters.bathroom_amount,
      });
    }

    if (Array.isArray(filters.room_amount) && filters.room_amount.length > 0) {
      qb.andWhere('p.room_amount IN (:...room_amount)', {
        room_amount: filters.room_amount,
      });
    }

    if (Array.isArray(filters.suite_amount) && filters.suite_amount.length > 0) {
      qb.andWhere('p.suite_amount IN (:...suite_amount)', {
        suite_amount: filters.suite_amount,
      });
    }

    if (Array.isArray(filters.parking_lot_amount) && filters.parking_lot_amount.length > 0) {
      qb.andWhere('p.parking_lot_amount IN (:...parking_lot_amount)', {
        parking_lot_amount: filters.parking_lot_amount,
      });
    }

    if (filters.age) {
      const ageRange = filters.age.split('-').map((v) => parseInt(v.trim(), 10));
      if (ageRange.length === 2 && !isNaN(ageRange[0]) && !isNaN(ageRange[1])) {
        qb.andWhere('p.age BETWEEN :age_min AND :age_max', { age_min: ageRange[0], age_max: ageRange[1] });
      } else {
        const age = parseInt(filters.age, 10);
        if (!isNaN(age)) {
          qb.andWhere('p.age = :age', { age });
        }
      }
    }

    if (Array.isArray(filters.orientation) && filters.orientation.length > 0) {
      qb.andWhere('p.orientation IN (:...orientation)', { orientation: filters.orientation });
    }

    if (Array.isArray(filters.disposition) && filters.disposition.length > 0) {
      qb.andWhere('p.dispositions IN (:...disposition)', {
        disposition: filters.disposition,
      });
    }

    // ESTO ATENDER , TIENE Q TRAER EXACTAMENTE LAS QUE MARCAS..AHORA ESTA COMO UN "SI TIENE ALGUNO DE LOS MARCADOS TRAE"
    if (Array.isArray(filters.tags) && filters.tags.length > 0) {
      qb.leftJoin('property_tags', 'pt', 'pt.propertyId = p.id')
        .andWhere('pt.tag_id IN (:...tags)', { tags: filters.tags });
    }

    if (filters.direct_owner !== undefined || filters.inmobiliaria !== undefined) {
      if (filters.direct_owner !== undefined && filters.inmobiliaria === undefined) {
        qb.andWhere('p.direct_owner = true');
      } else if (filters.inmobiliaria !== undefined && filters.direct_owner === undefined) {       
        qb.andWhere('p.direct_owner = false');
      }
    }

    if (filters.polygon) {
      const polygonPoints = this.parsePolygon(filters.polygon);
      this.applyPolygonFilter(qb, polygonPoints);
    } else if (
      filters.southWestLat != null && filters.southWestLng != null &&
      filters.northEastLat != null && filters.northEastLng != null
    ) {
      // Parsear strings a números
      const swLat = parseFloat(filters.southWestLat);
      const swLng = parseFloat(filters.southWestLng);
      const neLat = parseFloat(filters.northEastLat);
      const neLng = parseFloat(filters.northEastLng);
      if ([swLat, swLng, neLat, neLng].some(v => isNaN(v))) {
        throw new BadRequestException('Las coordenadas del bounding box deben ser números válidos');
      }
      const minLat = Math.min(swLat, neLat);
      const maxLat = Math.max(swLat, neLat);
      const minLng = Math.min(swLng, neLng);
      const maxLng = Math.max(swLng, neLng);
      qb.andWhere('p.geo_lat BETWEEN :minLat AND :maxLat', { minLat, maxLat });
      qb.andWhere('p.geo_long BETWEEN :minLng AND :maxLng', { minLng, maxLng });
    }

/*
    if (filters.q) {
      qb.andWhere(
        '(p.publication_title ILIKE :q OR p.street ILIKE :q OR p.reference_code ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }
*/
    return { qb, orderBy, orderDirection };
  }

  private parsePolygon(polygon: string): PolygonPoint[] {
    const rawValue = typeof polygon === 'string' ? polygon.trim() : '';
    if (!rawValue) {
      throw new BadRequestException('El polígono no puede estar vacío');
    }

    let normalizedPolygon = rawValue;
    try {
      normalizedPolygon = decodeURIComponent(rawValue);
    } catch {
      normalizedPolygon = rawValue;
    }

    const points: PolygonPoint[] = [];
    const pointRegex = /LatLng\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
    let match: RegExpExecArray | null;

    while ((match = pointRegex.exec(normalizedPolygon)) !== null) {
      const lat = Number.parseFloat(match[1]);
      const lng = Number.parseFloat(match[2]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestException('El polígono contiene coordenadas inválidas');
      }

      points.push({ lat, lng });
    }

    if (points.length < 3) {
      throw new BadRequestException('El polígono debe tener al menos 3 puntos válidos');
    }

    return points;
  }

  private applyPolygonFilter(qb: any, polygonPoints: PolygonPoint[]) {
    const latitudes = polygonPoints.map((point) => point.lat);
    const longitudes = polygonPoints.map((point) => point.lng);

    qb.andWhere('p.geo_lat IS NOT NULL')
      .andWhere('p.geo_long IS NOT NULL')
      .andWhere('p.geo_lat BETWEEN :polygonMinLat AND :polygonMaxLat', {
        polygonMinLat: Math.min(...latitudes),
        polygonMaxLat: Math.max(...latitudes),
      })
      .andWhere('p.geo_long BETWEEN :polygonMinLng AND :polygonMaxLng', {
        polygonMinLng: Math.min(...longitudes),
        polygonMaxLng: Math.max(...longitudes),
      });

    const edgeChecks: string[] = [];
    const parameters: Record<string, number> = {};

    for (let index = 0; index < polygonPoints.length; index++) {
      const currentPoint = polygonPoints[index];
      const nextPoint = polygonPoints[(index + 1) % polygonPoints.length];
      const currentLatKey = `polygonLat${index}`;
      const currentLngKey = `polygonLng${index}`;
      const nextLatKey = `polygonNextLat${index}`;
      const nextLngKey = `polygonNextLng${index}`;

      parameters[currentLatKey] = currentPoint.lat;
      parameters[currentLngKey] = currentPoint.lng;
      parameters[nextLatKey] = nextPoint.lat;
      parameters[nextLngKey] = nextPoint.lng;

      // PostgreSQL: use != for not equal, cast to float, and avoid NULLs
      edgeChecks.push(`CASE WHEN (((CAST(:${currentLatKey} AS float) > CAST(p.geo_lat AS float)) != (CAST(:${nextLatKey} AS float) > CAST(p.geo_lat AS float))) AND (CAST(p.geo_long AS float) < ((CAST(:${nextLngKey} AS float) - CAST(:${currentLngKey} AS float)) * (CAST(p.geo_lat AS float) - CAST(:${currentLatKey} AS float)) / NULLIF((CAST(:${nextLatKey} AS float) - CAST(:${currentLatKey} AS float)), 0) + CAST(:${currentLngKey} AS float)))) THEN 1 ELSE 0 END`);
    }

    qb.andWhere(`((${edgeChecks.join(' + ')}) % 2) = 1`, parameters);
  }
  
  // =============================================
  // END SEARCH PROPERTIES
  // =============================================

  // =============================================
  // MULTIMEDIA UPLOAD HELPERS
  // =============================================

  private async processAndUploadAttachedFiles(
    savedAttached: PropertyAttached[],
    files: Express.Multer.File[],
    propertyId: number,
  ) {
    const uploadPromises: Promise<void>[] = [];

    for (let i = 0; i < savedAttached.length; i++) {
        const attached = savedAttached[i];
        const file = files[i];

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
          }
        })();

        uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);
  }

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
   * 
   * Solo se usa para archivos Multer (buffers en memoria). Las
   * imágenes de URL externa son manejadas por el cron.
   */
  private async _processAndUploadImage(
    imageId: number,
    propertyId: number,
    imageSource: { file: Express.Multer.File },
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
      let errorMsg = err?.message ? `Error: ${err.message.substring(0, 100)}` : `Processing failed for image ID: ${imageId}`;
      errorMsg = errorMsg.substring(0, 1000);

      await this.propertyImageRepository.update(imageId, {
        upload_status: MediaUploadStatus.FAILED,
        error_message: errorMsg,
      });
      await this.propertyImageRepository.increment({ id: imageId }, 'retry_count', 1);

      console.error(`Failed to process image ID ${imageId}:`, err?.message || error);
    }
  }

  /**
   * Valida cada archivo individualmente para dar mensajes de error específicos
   */
  validateUploadedFiles(files: { images?: Express.Multer.File[]; attached?: Express.Multer.File[] }) {
    const maxSize = 10 * 1024 * 1024; // 10MB
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

  // =============================================
  // END MULTIMEDIA UPLOAD HELPERS
  // =============================================

 
}