import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyTag } from './entities/property-tag.entity';
import { PropertyOperation } from './entities/property-operation.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

import { S3Service } from '../../common/s3.service';
import { ImageUploadService } from '../../common/image-upload/image-upload.service';
import { PropertyVideo } from './entities/property-video.entity';
import { PropertyAttached } from './entities/property-attached.entity';
import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sanitizeFilename, getFileExtension, createUniqueFilename } from '../../common/helpers/file-helpers';

// --- IMPORTACIONES PARA DRAFT ---
import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { PropertyStatus, MediaUploadStatus } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from 'typeorm';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(PropertyImage)
    private propertyImageRepository: Repository<PropertyImage>,
    @InjectRepository(PropertyTag)
    private propertyTagRepository: Repository<PropertyTag>,
    @InjectRepository(PropertyOperation)
    private propertyOperationRepository: Repository<PropertyOperation>,
     @InjectRepository(PropertyVideo)
    private propertyVideoRepository: Repository<PropertyVideo>,
    @InjectRepository(PropertyAttached)
    private propertyAttachedRepository: Repository<PropertyAttached>,
    private readonly s3Service: S3Service,
    private readonly imageUploadService: ImageUploadService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

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
      currency: 'USD',
    });

    return this.propertyRepository.save(newProperty);
  }

  /**
   * Si se envían images, tags, operations, videos, multimedia360 o attached, se crearán automáticamente
   */
  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    // 1. Extraer las relaciones y multimedia del DTO
    const { 
      images, 
      tags, 
      operations, 
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

    // Crear la propiedad base
    const newProperty = this.propertyRepository.create({
      ...propertyData,
      deleted: false,
    });

    const savedProperty = await this.propertyRepository.save(newProperty) as unknown as Property;

    // 2. Guardar imágenes si se proporcionan
    if (images && images.length > 0) {
      const imagesToProcess: {
        imageId: number;
        originalUrl: string;
        propertyId: number;
      }[] = [];
      for (const imageData of images) {
        const propertyImage = this.propertyImageRepository.create({
          ...imageData,
          url: imageData.url ?? '', // Si no hay url, poner string vacío para compatibilidad
          property: savedProperty,
          upload_status: MediaUploadStatus.PENDING, // Será procesada en background
          retry_count: 0,
        });
        const savedImage = await this.propertyImageRepository.save(propertyImage) as unknown as PropertyImage;

        // Añadir a la lista de imágenes para procesar en segundo plano
        imagesToProcess.push({
          imageId: savedImage.id!,
          originalUrl: savedImage.url ?? '',
          propertyId: savedProperty.id!,
        });
      }

      // Disparar el proceso de subida en segundo plano SIN ESPERARLO (fire-and-forget)
      this.processAndUploadImages(imagesToProcess);
    }

    // 3. Crear los tags asociados si se proporcionan
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagData of tags) {
        const propertyTag = this.propertyTagRepository.create({
          ...tagData,
          property: savedProperty,
        });
        await this.propertyTagRepository.save(propertyTag);
      }
    }

    // 4. Crear las operaciones asociadas si se proporcionan
    if (operations && Array.isArray(operations) && operations.length > 0) {
      for (const operationData of operations) {
        const propertyOperation = this.propertyOperationRepository.create({
          ...operationData,
          property: savedProperty,
        });
        await this.propertyOperationRepository.save(propertyOperation);
      }
    }

    // 5. Crear videos si se proporcionan
    if (videos && Array.isArray(videos) && videos.length > 0) {
      for (const videoData of videos) {
        const propertyVideo = this.propertyVideoRepository.create({
          ...videoData,
          property: savedProperty,
          is_360: false,
        });
        await this.propertyVideoRepository.save(propertyVideo);
      }
    }

    // 6. Crear multimedia 360 si se proporcionan
    if (multimedia360 && Array.isArray(multimedia360) && multimedia360.length > 0) {
      for (const videoData of multimedia360) {
        const propertyVideo360 = this.propertyVideoRepository.create({
          ...videoData,
          property: savedProperty,
          is_360: true,
        });
        await this.propertyVideoRepository.save(propertyVideo360);
      }
    }

    // 7. Crear archivos adjuntos si se proporcionan
    if (attached && Array.isArray(attached) && attached.length > 0) {
      console.log(`🚨 DEBUG create - Processing ${attached.length} attached files`);
      
      const savedAttachedList: PropertyAttached[] = [];
      
      for (const attachedData of attached) {
        console.log(`🚨 DEBUG create - attachedData:`, attachedData);
        
        const propertyAttached = this.propertyAttachedRepository.create({
          ...attachedData,
          property: savedProperty,
          // Si viene con file_url, marcar como PENDING para procesamiento
          upload_status: attachedData.file_url ? MediaUploadStatus.PENDING : MediaUploadStatus.PENDING,
          upload_completed_at: null, // Será actualizado cuando se complete
          retry_count: 0,
        });
        const saveResult = await this.propertyAttachedRepository.save(propertyAttached);
        const savedAttached = Array.isArray(saveResult) ? saveResult[0] : saveResult;
        savedAttachedList.push(savedAttached);
        
        // Si tiene URL, procesar para descargar y subir a S3
        if (attachedData.file_url && attachedData.file_url.startsWith('http') && savedAttached.id) {
          console.log(`🚀 create - Processing URL: ${attachedData.file_url}`);
          setImmediate(() => {
            this._processAndUploadAttached(savedAttached.id!, savedProperty.id!, { originalUrl: attachedData.file_url! });
          });
        }
      }
      
      console.log(`📁 create - Queued ${savedAttachedList.length} attached files for processing`);
    }

    // 8. Retornar la propiedad con todas sus relaciones cargadas
    return this.findOne(savedProperty.id!);
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
    files: { images?: Express.Multer.File[]; attached?: Express.Multer.File[] },
  ) {
    const logContext = { propertyId, operation: 'saveMultimedia' };
    console.log('🚀 Starting multimedia save process', logContext);
    
    // Validar que la propiedad existe
    const property = await this.findOne(propertyId);
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    // Desestructurar datos del DTO
    const { videos, multimedia360, images: imagesData, attached: attachedData } = saveMultimediaDto;

    // Logging estructurado de entrada
    const inputSummary = {
      videos: videos?.length || 0,
      multimedia360: multimedia360?.length || 0,
      imageMetadata: imagesData?.length || 0,
      imageFiles: files.images?.length || 0,
      attachedMetadata: attachedData?.length || 0,
      attachedFiles: files.attached?.length || 0,
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

      // 1. Procesar Videos (URLs externas)
      if (videos && videos.length > 0) {
        console.log(`🎥 Processing ${videos.length} video URLs`);
        try {
          // Eliminar videos anteriores y crear nuevos
          await manager.delete(PropertyVideo, { property: { id: propertyId }, is_360: false });
          
          for (const videoData of videos) {
            const newVideo = manager.create(PropertyVideo, { 
              ...videoData, 
              property, 
              is_360: false 
            });
            await manager.save(PropertyVideo, newVideo);
            results.videos.processed++;
          }
          console.log(`✅ Successfully processed ${results.videos.processed} videos`);
        } catch (error) {
          console.error('❌ Error processing videos:', error instanceof Error ? error.message : JSON.stringify(error));
          results.videos.errors++;
          throw error;
        }
      }

      // 2. Procesar Multimedia 360 (URLs externas)
      if (multimedia360 && multimedia360.length > 0) {
        console.log(`🌐 Processing ${multimedia360.length} multimedia360 URLs`);
        try {
          // Eliminar tours 360 anteriores y crear nuevos
          await manager.delete(PropertyVideo, { property: { id: propertyId }, is_360: true });
          
          for (const videoData of multimedia360) {
            const newVideo360 = manager.create(PropertyVideo, { 
              ...videoData, 
              property, 
              is_360: true 
            });
            await manager.save(PropertyVideo, newVideo360);
            results.multimedia360.processed++;
          }
          console.log(`✅ Successfully processed ${results.multimedia360.processed} multimedia360`);
        } catch (error) {
          console.error('❌ Error processing multimedia360:', error instanceof Error ? error.message : JSON.stringify(error));
          results.multimedia360.errors++;
          throw error;
        }
      }

      // 3. Procesar Imágenes - Transacción atómica
      if (files.images && files.images.length > 0) {
        console.log(`🖼️ Processing ${files.images.length} image files`);
        
        // Validar correspondencia con metadatos si existen
        if (imagesData && imagesData.length > 0) {
          if (files.images.length !== imagesData.length) {
            throw new BadRequestException(
              `Mismatch: ${files.images.length} image files vs ${imagesData.length} metadata entries`
            );
          }
          console.log(`📋 Using provided metadata for ${imagesData.length} images`);
        } else {
          console.log(`📋 Using auto-generated metadata (sequential order)`);
        }

        try {
          // Eliminar imágenes anteriores y crear registros nuevos
          await manager.delete(PropertyImage, { property: { id: propertyId }});
          
          const savedImages: PropertyImage[] = [];
          const imageFiles = files.images;

          for (let i = 0; i < imageFiles.length; i++) {
            // Usar metadatos proporcionados o generar valores por defecto
            const imageData = (imagesData && imagesData[i]) ? imagesData[i] : {
              order_position: i + 1
            };

            const propertyImage = manager.create(PropertyImage, {
              property,
              order_position: imageData.order_position,
              url: null,
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyImage, propertyImage);
            savedImages.push(saved as PropertyImage);
            results.images.queued++;
          }

          // Procesar uploads en background
          setImmediate(() => {
            console.log(`🚀 Starting background image upload process for ${savedImages.length} images`);
            this.processAndUploadUploadedFiles(savedImages, imageFiles, propertyId);
          });
          
          console.log(`✅ Successfully queued ${results.images.queued} images for upload`);
        } catch (error) {
          console.error('❌ Error processing images:', error instanceof Error ? error.message : JSON.stringify(error));
          results.images.errors++;
          throw error;
        }
      }

      // 4. Procesar Archivos Adjuntos - Transacción atómica
      if (files.attached && files.attached.length > 0) {
        console.log(`📎 Processing ${files.attached.length} attached files`);
        
        // Información sobre metadatos
        if (attachedData && attachedData.length > 0) {
          console.log(`📋 Using provided metadata for ${attachedData.length} attachments`);
        } else {
          console.log(`📋 Using auto-generated metadata (sequential order)`);
        }

        try {
          // Eliminar archivos anteriores y crear registros nuevos
          await manager.delete(PropertyAttached, { property: { id: propertyId }});
          
          const savedAttached: PropertyAttached[] = [];
          const attachedFiles = files.attached;

          for (let i = 0; i < attachedFiles.length; i++) {
            // Usar metadatos proporcionados o generar valores por defecto
            const attachedInfo = (attachedData && attachedData[i]) ? attachedData[i] : {
              order: i + 1,
              description: `Documento ${i + 1}`,
              file_url: null
            };

            const propertyAttached = manager.create(PropertyAttached, {
              property,
              order: attachedInfo.order,
              description: attachedInfo.description || `Documento ${i + 1}`,
              file_url: attachedInfo.file_url || '',
              upload_status: MediaUploadStatus.PENDING,
              retry_count: 0,
            });
            const saved = await manager.save(PropertyAttached, propertyAttached);
            savedAttached.push(saved as PropertyAttached);
            results.attached.queued++;
          }

          // Procesar uploads en background
          setImmediate(() => {
            console.log(`🚀 Starting background attachment upload process for ${savedAttached.length} files`);
            this.processAndUploadAttachedFiles(savedAttached, attachedFiles, propertyId);
          });

          console.log(`✅ Successfully queued ${results.attached.queued} attachments for upload`);
        } catch (error) {
          console.error('❌ Error processing attached files:', error instanceof Error ? error.message : JSON.stringify(error));
          results.attached.errors++;
          throw error;
        }
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
    // Preparar promesas para procesamiento en paralelo
    const uploadPromises = [];
    
    for (let i = 0; i < savedAttached.length; i++) {
        const attached = savedAttached[i];
        const file = files[i];
        
        console.log(`🔍 DEBUG processAndUploadAttachedFiles - Processing attached[${i}]:`);
        console.log(`  - attached.id: ${attached.id}`);
        console.log(`  - attached.file_url: "${attached.file_url}"`);
        console.log(`  - file exists: ${!!file}`);
        console.log(`  - is URL: ${attached.file_url && attached.file_url.startsWith('http')}`);
        
        // Si el attached ya tiene una URL pero no hay archivo, procesar como URL 
        if (attached.file_url && attached.file_url.startsWith('http') && !file) {
          console.log(`🚀 Processing attached as URL: ${attached.file_url}`);
          uploadPromises.push(
            this._processAndUploadAttached(attached.id, propertyId, { originalUrl: attached.file_url! })
          );
          continue;
        }
        
        // Si no hay archivo, saltar
        if (!file) {
          continue;
        }
        
        // Crear promesa para upload del archivo
        const uploadPromise = (async () => {
          try {
              // Marcar como "uploading"
              await this.propertyAttachedRepository.update(attached.id, { 
                upload_status: MediaUploadStatus.UPLOADING 
              });

              // Usar helpers para construir s3Key y procesar upload
              const s3Key = this.buildS3Key(propertyId, 'attached', file.originalname, attached.id);
              await this.uploadAndUpdateEntity(
                this.propertyAttachedRepository,
                attached.id,
                file.buffer,
                s3Key,
                file.mimetype,
                { fileUrlField: 'file_url' }
              );
              
              console.log(`Successfully uploaded attached file: ${attached.id}`);
          } catch (error) {
              // Usar helper para manjo de errores
              await this.handleUploadError(
                this.propertyAttachedRepository,
                attached.id,
                error,
                'Failed to upload attached file'
              );
              
              // Si es error de circuit breaker, programar reintento automático
              const isCircuitBreakerError = error instanceof Error && error.message.includes('Circuit Breaker');
              if (isCircuitBreakerError) {
                const currentAttached = await this.propertyAttachedRepository.findOne({ where: { id: attached.id } });
                if (currentAttached && currentAttached.retry_count < 3) {
                  setTimeout(() => {
                    this.retryAttachedUpload(attached.id, file, propertyId);
                  }, 60000); // Reintentar en 1 minuto
                }
              }
          }
        })();
        
        uploadPromises.push(uploadPromise);
    }
    
    // Ejecutar todas las subidas en paralelo
    await Promise.all(uploadPromises);
  }

  /**
   * Reintentar upload de un archivo adjunto específico
   */
  private async retryAttachedUpload(attachedId: number, file: Express.Multer.File, propertyId: number) {
    try {
      await this.propertyAttachedRepository.update(attachedId, { 
        upload_status: MediaUploadStatus.UPLOADING,
        error_message: null
      });

      // Usar helpers para construir s3Key y procesar upload
      const s3Key = this.buildS3Key(propertyId, 'attached', file.originalname, attachedId);
      await this.uploadAndUpdateEntity(
        this.propertyAttachedRepository,
        attachedId,
        file.buffer,
        s3Key,
        file.mimetype,
        { fileUrlField: 'file_url' }
      );
      
      console.log(`Successfully retried attached file upload: ${attachedId}`);
    } catch (error) {
      // Usar helper para manejo de errores
      await this.handleUploadError(
        this.propertyAttachedRepository,
        attachedId,
        error,
        'Retry failed for attached file'
      );
    }
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
      relations: ['images', 'attributes', 'operations', 'tags', 'videos', 'attached'],
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
      relations: ['images', 'attributes', 'operations', 'tags', 'videos', 'attached'],
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
  ): Promise<Property> {
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

    // Aplicar cambios
    Object.assign(property, updatePropertyDto);

    return this.propertyRepository.save(property);
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
   * Restaurar una propiedad eliminada
   */
  async restore(id: number): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${id} no encontrada`);
    }

    if (!property.deleted) {
      throw new BadRequestException(
        'Esta propiedad no ha sido eliminada, no hay nada que restaurar',
      );
    }

    property.deleted = false;
    property.deleted_at = null;

    return this.propertyRepository.save(property);
  }

  /**
   * Obtener estadísticas de propiedades
   */
  async getStats(): Promise<any> {
    const total = await this.propertyRepository.count({
      where: { deleted: false },
    });

    const byStatus = await this.propertyRepository
      .createQueryBuilder('property')
      .select('property.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('property.deleted = :deleted', { deleted: false })
      .groupBy('property.status')
      .getRawMany();

    const byPropertyType = await this.propertyRepository
      .createQueryBuilder('property')
      .select('property.property_type', 'property_type')
      .addSelect('COUNT(*)', 'count')
      .where('property.deleted = :deleted', { deleted: false })
      .groupBy('property.property_type')
      .getRawMany();

    const avgPrice = await this.propertyRepository
      .createQueryBuilder('property')
      .select('AVG(property.price)', 'avg_price')
      .where('property.deleted = :deleted', { deleted: false })
      .getRawOne();

    return {
      total,
      byStatus,
      byPropertyType,
      avgPrice: parseFloat(avgPrice?.avg_price || 0),
    };
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
   * Obtener el estado de uploads para una propiedad específica
   */
  async getUploadStatus(propertyId: number) {
    const property = await this.findOne(propertyId);
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    // Obtener estado de imágenes
    const imagesStatus = await this.propertyImageRepository
      .createQueryBuilder('image')
      .select([
        'image.id',
        'image.url', 
        'image.upload_status',
        'image.retry_count',
        'image.error_message',
        'image.upload_completed_at',
        'image.order_position'
      ])
      .where('image.property = :propertyId', { propertyId })
      .orderBy('image.order_position', 'ASC')
      .getMany();

    // Obtener estado de archivos adjuntos
    const attachedStatus = await this.propertyAttachedRepository
      .createQueryBuilder('attached')
      .select([
        'attached.id',
        'attached.file_url',
        'attached.upload_status', 
        'attached.retry_count',
        'attached.error_message',
        'attached.upload_completed_at',
        'attached.order'
      ])
      .where('attached.property = :propertyId', { propertyId })
      .orderBy('attached.order', 'ASC')
      .getMany();

    // Calcular estadísticas
    const imageStats = this.calculateUploadStats(imagesStatus);
    const attachedStats = this.calculateUploadStats(attachedStatus);

    const allUploads = [...imagesStatus, ...attachedStatus];
    const overallStats = this.calculateUploadStats(allUploads);

    return {
      propertyId,
      overall: {
        ...overallStats,
        isCompleted: overallStats.pending === 0 && overallStats.uploading === 0,
        hasErrors: overallStats.failed > 0
      },
      images: {
        count: imagesStatus.length,
        stats: imageStats,
        items: imagesStatus
      },
      attached: {
        count: attachedStatus.length,
        stats: attachedStats,
        items: attachedStatus
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Helper para calcular estadísticas de upload
   */
  private calculateUploadStats(items: any[]) {
    const stats = {
      total: items.length,
      pending: 0,
      uploading: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      progressPercentage: 0
    };

    items.forEach(item => {
      switch (item.upload_status) {
        case MediaUploadStatus.PENDING:
          stats.pending++;
          break;
        case MediaUploadStatus.UPLOADING:
          stats.uploading++;
          break;
        case MediaUploadStatus.COMPLETED:
          stats.completed++;
          break;
        case MediaUploadStatus.FAILED:
          stats.failed++;
          break;
        case MediaUploadStatus.RETRYING:
          stats.retrying++;
          break;
      }
    });

    stats.progressPercentage = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0;

    return stats;
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
    const healthCheck = await this.s3Service.healthCheck();
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
  // MULTIMEDIA UPLOAD HELPERS (DRY)
  // =============================================

  /**
   * Construir s3Key de forma consistente para cualquier tipo de archivo
   */
  private buildS3Key(propertyId: number, mediaType: 'images' | 'attached', filename: string, entityId?: number): string {
    const environment = this.configService.get('NODE_ENV');
    const pathPrefix = environment === 'production' ? '' : 'localhost/';
    
    // Para archivos adjuntos, limpiar el nombre y agregar el ID de la entidad
    if (mediaType === 'attached' && entityId) {
      const cleanedFilename = this.cleanFilenameForUrl(filename, entityId);
      return `${pathPrefix}properties/${propertyId}/${mediaType}/${cleanedFilename}`;
    }
    
    return `${pathPrefix}properties/${propertyId}/${mediaType}/${filename}`;
  }

  /**
   * Limpiar nombre de archivo para que sea seguro para URL y único
   */
  private cleanFilenameForUrl(originalFilename: string, entityId: number): string {
    const sanitizedBasename = sanitizeFilename(originalFilename);
    const extension = getFileExtension(originalFilename);
    return createUniqueFilename(sanitizedBasename, entityId, extension);
  }

  /**
   * Upload genérico a S3 + actualización de entidad
   */
  private async uploadAndUpdateEntity<T extends Record<string, any>>(
    repository: Repository<T>,
    entityId: number,
    fileBuffer: Buffer,
    s3Key: string,
    mimetype: string,
    updateFields: { fileUrlField: keyof T }
  ): Promise<void> {
    // Subir a S3
    await this.s3Service.uploadFile(fileBuffer, s3Key, mimetype);
    
    // Actualizar entidad con éxito
    const updateData = {
      [updateFields.fileUrlField]: s3Key,
      upload_status: MediaUploadStatus.COMPLETED,
      upload_completed_at: new Date(),
      error_message: null
    } as any;
    
    await repository.update(entityId, updateData);
  }

  /**
   * Manejo consistente de errores de upload
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
      // Generar el key con la estructura correcta
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const filename = `${imageId}-${timestamp}.${fileExtension}`;
      
      // Usar helper para construir s3Key y procesar upload
      const s3Key = this.buildS3Key(propertyId, 'images', filename);
      await this.uploadAndUpdateEntity(
        this.propertyImageRepository,
        imageId,
        file.buffer,
        s3Key,
        file.mimetype,
        { fileUrlField: 'url' }
      );

      return s3Key; // Retornar la ruta relativa
    } catch (error) {
      // Usar helper para manejo de errores
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
   * Puede recibir un buffer de archivo o una URL de imagen original.
   */
  private async _processAndUploadImage(
    imageId: number,
    propertyId: number,
    imageSource: { file?: Express.Multer.File; originalUrl?: string },
  ) {
    try {
      // Marcar como "uploading"
      await this.propertyImageRepository.update(imageId, { 
        upload_status: MediaUploadStatus.UPLOADING 
      });

      let fileToUpload: Express.Multer.File;

      // Si se proporciona una URL, descarga la imagen primero
      if (imageSource.originalUrl) {
        const response = await axios.get(imageSource.originalUrl, {
          responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'] || 'image/jpeg';
        const fileExtension = mimeType.split('/')[1] || 'jpg';

        fileToUpload = {
          buffer: imageBuffer,
          mimetype: mimeType,
          originalname: `${imageId}.${fileExtension}`,
        } as Express.Multer.File;
      } else if (imageSource.file) {
        fileToUpload = imageSource.file;
      } else {
        throw new Error('Debe proporcionar un archivo o una URL original.');
      }

      // Subir a S3
      const s3Url = await this.uploadImageToS3(
        fileToUpload,
        imageId,
        propertyId,
      );

      if (s3Url) {
        // Actualizar como completado
        await this.propertyImageRepository.update(imageId, { 
          url: s3Url, 
          upload_status: MediaUploadStatus.COMPLETED,
          upload_completed_at: new Date(),
          error_message: null
        });
        console.log(`Successfully uploaded and updated image: ${imageId}`);
      } else {
        throw new Error('S3 upload returned null URL');
      }
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

      // Marcar como fallido o reintento e incrementar retry_count
      await this.propertyImageRepository.update(imageId, { 
        upload_status: errorStatus,
        error_message: errorMsg
      });
      await this.propertyImageRepository.increment({ id: imageId }, 'retry_count', 1);
      
      console.error(
        `Failed to process image ID ${imageId}:`,
        err?.message || error,
      );
      
      // Si es error de circuit breaker y tenemos URL original, programar reintento automático
      if (isCircuitBreakerError && imageSource.originalUrl) {
        const currentImage = await this.propertyImageRepository.findOne({ where: { id: imageId } });
        if (currentImage && currentImage.retry_count < 3) {
          setTimeout(() => {
            this._processAndUploadImage(imageId, propertyId, imageSource);
          }, 60000); // Reintentar en 1 minuto
        }
      }
    }
  }

  /**
   * Procesar y subir archivo adjunto (privado)
   * Puede recibir un buffer de archivo o una URL de archivo original.
   */
  private async _processAndUploadAttached(
    attachedId: number,
    propertyId: number,
    attachedSource: { file?: Express.Multer.File; originalUrl?: string },
  ) {
    console.log(`🔍 DEBUG _processAndUploadAttached - Starting:`);
    console.log(`  - attachedId: ${attachedId}`);
    console.log(`  - propertyId: ${propertyId}`);
    console.log(`  - originalUrl: ${attachedSource.originalUrl}`);
    console.log(`  - has file: ${!!attachedSource.file}`);
    
    try {
      await this.propertyAttachedRepository.update(attachedId, { 
        upload_status: MediaUploadStatus.UPLOADING,
        error_message: null
      });

      let fileBuffer: Buffer;
      let filename: string;
      let mimetype: string;

      // Si se proporciona una URL, descarga el archivo primero
      if (attachedSource.originalUrl) {
        const response = await axios.get(attachedSource.originalUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          validateStatus: (status) => status < 400,
        });

        fileBuffer = Buffer.from(response.data);
        
        // Obtener el filename de la URL o generar uno por defecto
        const urlParts = attachedSource.originalUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        filename = lastPart.includes('.') ? lastPart.split('?')[0] : `attached_${attachedId}`;
        
        // Obtener mimetype del header o asumir por defecto
        mimetype = response.headers['content-type'] || 'application/octet-stream';
      } else if (attachedSource.file) {
        fileBuffer = attachedSource.file.buffer;
        filename = attachedSource.file.originalname;
        mimetype = attachedSource.file.mimetype;
      } else {
        throw new Error('No file source provided');
      }

      // Subir a S3 usando helpers
      const s3Key = this.buildS3Key(propertyId, 'attached', filename, attachedId);
      await this.uploadAndUpdateEntity(
        this.propertyAttachedRepository,
        attachedId,
        fileBuffer,
        s3Key,
        mimetype,
        { fileUrlField: 'file_url' }
      );

      console.log(`Successfully processed attached file: ${attachedId}`);
    } catch (error) {
      // Manejo específico de errores de descarga de URL
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
      
      // Usar helper para el resto del manejo de errores
      await this.handleUploadError(
        this.propertyAttachedRepository,
        attachedId,
        error,
        contextInfo
      );
      
      // Si es error de circuit breaker y tenemos URL original, programar reintento automático
      const isCircuitBreakerError = error instanceof Error && error.message.includes('Circuit Breaker');
      if (isCircuitBreakerError && attachedSource.originalUrl) {
        const currentAttached = await this.propertyAttachedRepository.findOne({ where: { id: attachedId } });
        if (currentAttached && currentAttached.retry_count < 3) {
          setTimeout(() => {
            this._processAndUploadAttached(attachedId, propertyId, attachedSource);
          }, 60000); // Reintentar en 1 minuto
        }
      }
    }
  }
}