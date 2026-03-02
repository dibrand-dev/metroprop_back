import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyAttribute } from './entities/property-attribute.entity';
import { PropertyOperation } from './entities/property-operation.entity';
import { PropertyTag } from './entities/property-tag.entity';

import { PropertyVideo } from './entities/property-video.entity';
import { PropertyAttached } from './entities/property-attached.entity';

import { S3Service } from '../../common/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      PropertyImage,
      PropertyAttribute,
      PropertyOperation,
      PropertyTag,
      PropertyVideo,
      PropertyAttached,
    ]),
    ImageUploadModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, S3Service],
  exports: [PropertiesService],
})
export class PropertiesModule {}
