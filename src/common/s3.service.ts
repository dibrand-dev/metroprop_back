import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class S3Service {
  private s3: S3;

  constructor() {
    this.s3 = new S3({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Sube un archivo a S3. El parámetro key debe incluir la carpeta (ej: properties/..., users/..., organizations/...)
   * El bucket se toma de process.env.AWS_S3_BUCKET_NAME, pero puede ser modificado si se requiere multi-bucket.
   */
  async uploadImage(fileBuffer: Buffer, key: string, mimeType: string, bucketName?: string): Promise<string> {
    const bucket = bucketName || process.env.AWS_S3_BUCKET_NAME!;
    const params: S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read',
    };
    await this.s3.putObject(params).promise();
    return key;
  }
}
