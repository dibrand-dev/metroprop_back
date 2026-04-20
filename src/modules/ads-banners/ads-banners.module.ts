import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsBanner } from './entities/ads-banner.entity';
import { AdsBannersService } from './ads-banners.service';
import { AdsBannersController } from './ads-banners.controller';
import { MediaModule } from '../../common/media/media.module';

@Module({
  imports: [TypeOrmModule.forFeature([AdsBanner]), MediaModule],
  providers: [AdsBannersService],
  controllers: [AdsBannersController],
  exports: [AdsBannersService],
})
export class AdsBannersModule {}
