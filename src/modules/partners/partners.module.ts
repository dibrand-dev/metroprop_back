import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './entities/partner.entity';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PartnerApiController } from './partner-api.controller';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Partner]), ImageUploadModule],
  providers: [PartnersService, ApiKeyAuthGuard],
  controllers: [PartnersController, PartnerApiController],
  exports: [PartnersService],
})
export class PartnersModule {}
