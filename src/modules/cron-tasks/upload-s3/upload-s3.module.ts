import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyImage } from '../../properties/entities/property-image.entity';
import { PropertyAttached } from '../../properties/entities/property-attached.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { MediaModule } from '../../../common/media/media.module';
import { UploadS3Service } from './upload-s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyImage, PropertyAttached, Organization, Branch, User]),
    MediaModule,
  ],
  providers: [UploadS3Service],
  exports: [UploadS3Service],
})
export class UploadS3CronModule {}
