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
import { CreatePropertyWithRelationsDto } from './dto/create-property-with-relations.dto';

import { S3Service } from '../../common/s3.service';

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
  ) {}

  /**
   * Crear nueva propiedad
   */
  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    // Verificar que no exista una propiedad con el mismo reference_code
    const existingProperty = await this.propertyRepository.findOne({
      where: { reference_code: createPropertyDto.reference_code },
    });

    if (existingProperty) {
      throw new BadRequestException(
        'Una propiedad con este código de referencia ya existe',
      );
    }

    // Generar ID (puedes usar UUID o una secuencia)
    const newProperty = this.propertyRepository.create({
      ...createPropertyDto,
      deleted: false,
    });

    return this.propertyRepository.save(newProperty);
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
  async uploadImageToS3(file: Express.Multer.File, key: string): Promise<string> {
    const { PROPERTY_IMAGE_FOLDER } = await import('../../common/constants');
    const filenamePath = `${PROPERTY_IMAGE_FOLDER}/${key}`;
    return this.s3Service.uploadImage(file.buffer, filenamePath, file.mimetype);
  }

  /**
   * Crear propiedad con imágenes, tags y operaciones relacionadas
   */
  async createWithRelations(
    dto: CreatePropertyWithRelationsDto,
  ): Promise<Property> {
    // 1. Crear la propiedad base usando el método create existente
    const { images, tags, operations, ...propertyData } = dto;

    // Verificar que no exista una propiedad con el mismo reference_code
    const existingProperty = await this.propertyRepository.findOne({
      where: { reference_code: propertyData.reference_code },
    });

    if (existingProperty) {
      throw new BadRequestException(
        'Una propiedad con este código de referencia ya existe',
      );
    }

    // Crear la propiedad
    const newProperty = this.propertyRepository.create({
      ...propertyData,
      deleted: false,
    });

    const savedProperty = await this.propertyRepository.save(newProperty);

    // 2. Crear las imágenes asociadas
    if (images && Array.isArray(images) && images.length > 0) {
      for (const imageData of images) {
        let imageUrl = imageData.url;
        // Si imageData tiene buffer y mimetype, subir a S3
        if ((imageData as any).buffer && (imageData as any).mimetype) {
          imageUrl = await this.s3Service.uploadImage((imageData as any).buffer, `properties/${Date.now()}_${(imageData as any).originalname || 'image'}`, (imageData as any).mimetype);
        }
        const propertyImage = this.propertyImageRepository.create({
          ...imageData,
          url: imageUrl,
          property: savedProperty,
        });
        await this.propertyImageRepository.save(propertyImage);
      }
    }

    // 3. Crear los tags asociados
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagData of tags) {
        const propertyTag = this.propertyTagRepository.create({
          ...tagData,
          property: savedProperty,
        });
        await this.propertyTagRepository.save(propertyTag);
      }
    }

    // 4. Crear las operaciones asociadas
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
}
