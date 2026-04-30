import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favourite } from './entities/favourite.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { FavouritesService } from './favourites.service';
import { FavouritesController } from './favourites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favourite, User, Property])],
  providers: [FavouritesService],
  controllers: [FavouritesController],
  exports: [FavouritesService],
})
export class FavouritesModule {}