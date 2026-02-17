import { Module } from '@nestjs/common';
import { ImageUploadService } from './image-upload.service';
import { S3Service } from '../s3.service';

@Module({
  providers: [ImageUploadService, S3Service],
  exports: [ImageUploadService],
})
export class ImageUploadModule {}
