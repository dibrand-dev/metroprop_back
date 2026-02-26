import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../s3.service';
import { ImageUploadConfig } from './dto/image-upload-config.dto';

@Injectable()
export class ImageUploadService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  async uploadImage<T>(
    file: Express.Multer.File,
    config: ImageUploadConfig<T>,
  ): Promise<{ url: string | null; key: string }> {
    const { repository, entityId, imageFieldName, statusFieldName, s3Folder, primaryKeyField = 'id' } = config;

    // 1. Chequear existencia de la entidad
    const entity = await repository.findOne({ where: { [primaryKeyField]: entityId } as any });
    if (!entity) {
      throw new NotFoundException(`Entity with id ${entityId} not found.`);
    }

    // 2. Generar key con prefijo localhost para desarrollo
    const timestamp = Date.now();
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const key = `${entityId}/${timestamp}.${fileExtension}`;
    const environment = this.configService.get('NODE_ENV');
    const pathPrefix = environment === 'production' ? '' : 'localhost/';
    const filenamePath = `${pathPrefix}${s3Folder}/${key}`;

    // 3. Subir a S3 y manejar errores
    try {
      const url = await this.s3Service.uploadImage(file.buffer, filenamePath, file.mimetype);
      
      // 4. Actualizar entidad (éxito)
      await repository.update(entityId, {
        [imageFieldName]: url,
        [statusFieldName]: null,
      } as any);

      return { url, key };
    } catch (error) {
      // 5. Actualizar entidad (error)
      const errorMsg = JSON.stringify({
        error: (error as Error)?.message || 'S3 upload failed',
        details: error,
      });
      await repository.update(entityId, { [statusFieldName]: errorMsg } as any);

      return { url: null, key };
    }
  }
}
