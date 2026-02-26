import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  S3Client, 
  PutObjectCommand, 
  PutObjectCommandInput,
  ListObjectsV2Command 
} from '@aws-sdk/client-s3';
import { 
  fromInstanceMetadata, 
  fromEnv,
  fromContainerMetadata 
} from '@aws-sdk/credential-providers';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.s3Client = this.createS3Client();
  }

  private createS3Client(): S3Client {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const environment = this.configService.get('NODE_ENV');
    const testMode = this.configService.get('AWS_TEST_MODE');
    
    let credentials;
    
    if (testMode === 'localstack') {
      // TESTING: LocalStack (AWS simulator local)
      this.logger.log('🧪 Using LocalStack for local AWS testing');
      return new S3Client({
        region,
        endpoint: this.configService.get('LOCALSTACK_ENDPOINT', 'http://localhost:4566'),
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        },
        forcePathStyle: true,
      });
    }
    
    if (environment === 'production') {
      // PRODUCCIÓN: IAM Roles automáticos
      this.logger.log('🔐 Using IAM Role credentials for production');
      try {
        credentials = fromInstanceMetadata({ timeout: 1000, maxRetries: 3 });
      } catch {
        credentials = fromContainerMetadata({ timeout: 1000, maxRetries: 3 });
      }
    } else if (environment === 'staging' && this.configService.get('AWS_USE_IAM_ROLE') === 'true') {
      // STAGING: Testing IAM en AWS
      this.logger.log('🧪 Testing IAM Role credentials in staging');
      credentials = fromInstanceMetadata({ timeout: 1000, maxRetries: 3 });
    } else {
      // DESARROLLO: Access keys tradicionales
      this.logger.log('🔧 Using access key credentials for development');
      credentials = fromEnv();
    }

    return new S3Client({
      region,
      credentials,
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
  }

  /**
   * Obtiene el prefijo del path según el ambiente
   * - Production (EC2 IAM Role): '' (vacío)
   * - Desarrollo (Access Keys): 'localhost/' para separar archivos locales
   */
  getPathPrefix(): string {
    const environment = this.configService.get('NODE_ENV');
    return environment === 'production' ? '' : 'localhost/';
  }

  /**
   * Sube un archivo a S3. MANTIENE la interfaz original para compatibilidad
   */
  async uploadImage(fileBuffer: Buffer, key: string, mimeType: string, bucketName?: string): Promise<string> {
    const bucket = bucketName || this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    
    const params: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: this.configService.get('NODE_ENV') === 'production' ? 'private' : 'public-read',
      ServerSideEncryption: 'AES256',
      Metadata: {
        uploadedAt: new Date().toISOString(),
        service: 'metroprop-backend',
        version: '3.0'
      }
    };

    try {
      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      
      this.logger.log(`✅ File uploaded successfully: ${key} to ${bucket}`);
      return key; // Mantiene compatibilidad con la interfaz original
      
    } catch (error) {
      this.logger.error(`❌ S3 upload failed for key: ${key}`, error);
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * NUEVO: Test de conectividad S3
   */
  async healthCheck() {
    try {
      const bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
      await this.s3Client.send(new ListObjectsV2Command({ 
        Bucket: bucket, 
        MaxKeys: 1 
      }));
      
      this.logger.log(`✅ S3 health check passed for bucket: ${bucket}`);
      return { status: 'healthy', bucket, region: this.configService.get('AWS_REGION') };
      
    } catch (error) {
      this.logger.error(`❌ S3 health check failed`, error);
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * HELPER: Para debugging - mostrar configuración actual
   */
  getConfig() {
    const environment = this.configService.get('NODE_ENV');
    const isProduction = environment === 'production';
    return {
      environment,
      region: this.configService.get('AWS_REGION'),
      bucket: this.configService.get('AWS_S3_BUCKET_NAME'),
      testMode: this.configService.get('AWS_TEST_MODE'),
      useIamRole: this.configService.get('AWS_USE_IAM_ROLE'),
      hasAccessKey: !!this.configService.get('AWS_ACCESS_KEY_ID'),
      pathPrefix: this.getPathPrefix(),
      credentialsSource: isProduction 
        ? '🔐 EC2 IAM Role (No Access Keys)' 
        : '🔑 Access Keys + localhost/ prefix for local files',
    };
  }
}
