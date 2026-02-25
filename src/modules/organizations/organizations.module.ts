import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { S3Service } from '../../common/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization]), ImageUploadModule],
  providers: [OrganizationsService, S3Service],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}