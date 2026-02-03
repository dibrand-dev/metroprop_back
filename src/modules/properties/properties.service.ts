import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertiesRepository: Repository<Property>,
  ) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string): Promise<Property> {
    const property = this.propertiesRepository.create({
      ...createPropertyDto,
      ownerId: userId,
    });

    return this.propertiesRepository.save(property);
  }

  async findAll(
    limit: number = 10,
    offset: number = 0,
    filters?: { city?: string; propertyType?: string; status?: string },
  ) {
    const query = this.propertiesRepository.createQueryBuilder('property');

    if (filters?.city) {
      query.andWhere('property.city ILIKE :city', { city: `%${filters.city}%` });
    }

    if (filters?.propertyType) {
      query.andWhere('property.propertyType = :propertyType', {
        propertyType: filters.propertyType,
      });
    }

    if (filters?.status) {
      query.andWhere('property.status = :status', { status: filters.status });
    }

    const [properties, total] = await query
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { properties, total };
  }

  async findById(id: string): Promise<Property> {
    const property = await this.propertiesRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async findByOwnerId(userId: string, limit: number = 10, offset: number = 0) {
    const [properties, total] = await this.propertiesRepository.findAndCount({
      where: { ownerId: userId },
      skip: offset,
      take: limit,
      relations: ['owner'],
    });

    return { properties, total };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    userId: string,
  ): Promise<Property> {
    const property = await this.findById(id);

    if (property.ownerId !== userId) {
      throw new ForbiddenException('You can only update your own properties');
    }

    Object.assign(property, updatePropertyDto);

    return this.propertiesRepository.save(property);
  }

  async remove(id: string, userId: string): Promise<void> {
    const property = await this.findById(id);

    if (property.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own properties');
    }

    await this.propertiesRepository.delete(id);
  }
}
