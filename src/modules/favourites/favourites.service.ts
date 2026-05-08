import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favourite } from './entities/favourite.entity';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(Favourite)
    private readonly favouritesRepository: Repository<Favourite>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Property)
    private readonly propertiesRepository: Repository<Property>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async toggle(toggleFavouriteDto: ToggleFavouriteDto) {
    const user_id = toggleFavouriteDto.user_id!;
    await this.validateReferences(
      user_id,
      toggleFavouriteDto.property_id,
    );

    const existingFavourite = await this.favouritesRepository.findOne({
      where: {
        user_id: user_id,
        property_id: toggleFavouriteDto.property_id,
      },
    });

    if (existingFavourite) {
      await this.favouritesRepository.delete(existingFavourite.id);
      return {
        status: false,
      };
    }

    const favourite = this.favouritesRepository.create({
      user_id: user_id,
      property_id: toggleFavouriteDto.property_id,
    });

    const savedFavourite = await this.favouritesRepository.save(favourite);
    return {
      status: true,
      favourite: savedFavourite,
    };
  }

  async getPropertyIdsByUserId(userId: number): Promise<number[]> {
    const favourites = await this.favouritesRepository.find({
      where: { user_id: userId },
      select: ['property_id'],
      order: { created_at: 'DESC' },
    });
    return favourites.map((f) => f.property_id);
  }

  async getFavouriteProperties(userId: number) {
    const ids = await this.getPropertyIdsByUserId(userId);
    if (!ids.length) return [];
    // Preserve the favourite order (most recently added first)
    const cards = await this.propertiesService.getPropertiesCardsByIds(ids);
    const indexMap = new Map(ids.map((id, i) => [id, i]));
    return cards.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
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