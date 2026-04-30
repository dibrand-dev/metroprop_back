import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favourite } from './entities/favourite.entity';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(Favourite)
    private readonly favouritesRepository: Repository<Favourite>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Property)
    private readonly propertiesRepository: Repository<Property>,
  ) {}

  async toggle(toggleFavouriteDto: ToggleFavouriteDto) {
    await this.validateReferences(
      toggleFavouriteDto.user_id,
      toggleFavouriteDto.property_id,
    );

    const existingFavourite = await this.favouritesRepository.findOne({
      where: {
        user_id: toggleFavouriteDto.user_id,
        property_id: toggleFavouriteDto.property_id,
      },
    });

    if (toggleFavouriteDto.status) {
      if (existingFavourite) {
        return {
          status: true,
          favourite: existingFavourite,
        };
      }

      const favourite = this.favouritesRepository.create({
        user_id: toggleFavouriteDto.user_id,
        property_id: toggleFavouriteDto.property_id,
      });

      const savedFavourite = await this.favouritesRepository.save(favourite);
      return {
        status: true,
        favourite: savedFavourite,
      };
    }

    if (existingFavourite) {
      await this.favouritesRepository.delete(existingFavourite.id);
    }

    return {
      status: false,
    };
  }

  async getByUserId(userId: number): Promise<Favourite[]> {
    return this.favouritesRepository.find({
      where: { user_id: userId },
      relations: ['property'],
      order: { created_at: 'DESC' },
    });
  }

  private async validateReferences(userId: number, propertyId: number): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
      select: ['id'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (userId <= 0 || propertyId <= 0) {
      throw new BadRequestException('Invalid favourite references');
    }
  }
}