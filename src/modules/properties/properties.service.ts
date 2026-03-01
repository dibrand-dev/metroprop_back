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
import { ImageUploadConfig } from '../../common/image-upload/dto/image-upload-config.dto';
import axios from 'axios';

// --- IMPORTACIONES PARA DRAFT ---
import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { PropertyStatus } from '../../common/enums';
import { v4 as uuidv4 } from 'uuid';

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
    private readonly s3Service: S3Service,
    private readonly imageUploadService: ImageUploadService,
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
   * Si se envían images, tags u operations, se crearán automáticamente
   */
  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    // 1. Extraer las relaciones del DTO
    const { images, tags, operations, ...propertyData } = createPropertyDto;

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

    const savedProperty = await this.propertyRepository.save(newProperty);

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
        });
        const savedImage = await this.propertyImageRepository.save(propertyImage);

        // Añadir a la lista de imágenes para procesar en segundo plano
        imagesToProcess.push({
          imageId: savedImage.id,
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

    // 5. Retornar la propiedad con todas sus relaciones cargadas
    return this.findOne(savedProperty.id!);
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
      relations: ['images', 'attributes', 'operations', 'tags'],
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
      relations: ['images', 'attributes', 'operations', 'tags'],
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
   * Sube una imagen de propiedad a S3 usando el key relativo (ej: 147/imagen.jpg)
   * El path final será properties/147/imagen.jpg
   */
  async uploadImageToS3(file: Express.Multer.File, imageId: number, propertyId: number): Promise<string | null> {
    const { PROPERTY_IMAGE_FOLDER } = await import('../../common/constants');
    const config: ImageUploadConfig<any> = {
      repository: this.propertyImageRepository,
      entityId: imageId,
      imageFieldName: 'url',
      statusFieldName: 'status',
      s3Folder: PROPERTY_IMAGE_FOLDER,
      primaryKeyField: 'id',
    };
    const result = await this.imageUploadService.uploadImage(file, config);
    return result.url;
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
   * Property wizzard step images upload 
   * Carga imágenes recibidas por file upload de forma asíncrona. 
   * Guarda cada imagen en la base con status 'pending', responde con los IDs y status,
   * y lanza la subida real a S3 en segundo plano (fire-and-forget).
   */
  async uploadImagesAsync(files: Express.Multer.File[], propertyId: number) {
    // 1. Guardar cada imagen en la base con status 'pending' y sin url
    const property = await this.propertyRepository.findOne({ where: { id: propertyId, deleted: false } });
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${propertyId} no encontrada`);
    }

    const savedImages: PropertyImage[] = [];
    for (const file of files) {
      const propertyImage = this.propertyImageRepository.create({
        property,
        url: null, // url es string | null
        status: 'pending',
        is_blueprint: false,
      });
      const saved = await this.propertyImageRepository.save(propertyImage);
      savedImages.push(saved);
    }

    // 2. Lanzar proceso asíncrono para subir a S3 y actualizar la base
    setImmediate(() => {
      this.processAndUploadUploadedFiles(savedImages, files, propertyId);
    });

    // 3. Responder con los IDs y status
    return savedImages.map(img => ({ id: img.id, status: img.status }));
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
    for (let i = 0; i < savedImages.length; i++) {
      const image = savedImages[i];
      const file = files[i];
      await this._processAndUploadImage(image.id, propertyId, { file });
    }
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
        // Actualizar la URL en la base de datos en caso de éxito
        await this.propertyImageRepository.update(imageId, { url: s3Url, status: null, try: 0 });
        console.log(`Successfully uploaded and updated image: ${imageId}`);
      } else {
        // Si falla la subida a S3, registrar el error
        const errorMsg = `S3 upload failed for image ID: ${imageId}`;
        await this.propertyImageRepository.increment({ id: imageId }, 'try', 1);
        await this.propertyImageRepository.update(imageId, { status: errorMsg });
        console.error(errorMsg);
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

      // Incrementar 'try' y actualizar el estado en caso de error
      await this.propertyImageRepository.increment({ id: imageId }, 'try', 1);
      await this.propertyImageRepository.update(imageId, { status: errorMsg });
      console.error(
        `Failed to process image ID ${imageId}:`,
        err?.message || error,
      );
    }
  }
}