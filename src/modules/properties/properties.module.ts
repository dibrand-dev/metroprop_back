import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { UploadS3CronModule } from '../cron-tasks/upload-s3/upload-s3.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertyWriteService } from './property-write.service';
import { PropertiesController } from './properties.controller';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyAttribute } from './entities/property-attribute.entity';
import { PropertyTag } from './entities/property-tag.entity';
import { Tag } from '../tags/entities/tag.entity';

import { PropertyVideo } from './entities/property-video.entity';
import { PropertyAttached } from './entities/property-attached.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      PropertyImage,
      PropertyAttribute,
      PropertyTag,
      Tag,
      PropertyVideo,
      PropertyAttached,
    ]),
    ImageUploadModule,
    UploadS3CronModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyWriteService],
  exports: [PropertiesService, PropertyWriteService],
})
export class PropertiesModule {}
