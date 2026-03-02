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

// Circuit Breaker states
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Blocking requests due to failures  
  HALF_OPEN = 'half-open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening circuit
  timeout: number;               // Time before attempting recovery
  resetTimeout: number;          // Time to stay in half-open state
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  
  // Circuit Breaker state
  private circuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  
  private readonly circuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,    // Open after 5 failures
    timeout: 30000,         // Wait 30s before half-open
    resetTimeout: 10000     // 10s to test recovery
  };

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
    // Check circuit breaker state
    if (!this.canExecute()) {
      throw new Error(`S3 Circuit Breaker is ${this.circuitState}. Service temporarily unavailable.`);
    }

    try {
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

      const command = new PutObjectCommand(params);
      await this.s3Client.send(command);
      
      this.logger.log(`✅ File uploaded successfully: ${key} to ${bucket}`);
      this.onSuccess();
      return key; // Mantiene compatibilidad con la interfaz original
      
    } catch (error) {
      this.onFailure(error);
      this.logger.error(`❌ S3 upload failed for key: ${key}`, error);
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sube un archivo genérico a S3 con Circuit Breaker.
   */
  async uploadFile(fileBuffer: Buffer, key: string, mimeType: string, bucketName?: string): Promise<string> {
    // Check circuit breaker state
    if (!this.canExecute()) {
      throw new Error(`S3 Circuit Breaker is ${this.circuitState}. Service temporarily unavailable.`);
    }

    try {
      const result = await this.executeS3Upload(fileBuffer, key, mimeType, bucketName);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute the actual S3 upload
   */
  private async executeS3Upload(fileBuffer: Buffer, key: string, mimeType: string, bucketName?: string): Promise<string> {
    const bucket = bucketName || this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    
    const params: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read', // Para que los archivos adjuntos sean accesibles
    };

    const command = new PutObjectCommand(params);
    await this.s3Client.send(command);
    
    // Construir la URL pública manualmente
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    
    this.logger.log(`Successfully uploaded file to ${url}`);
    return url;
  }

  /**
   * Check if circuit breaker allows execution
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.circuitState) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        if (now >= this.nextAttemptTime) {
          this.circuitState = CircuitState.HALF_OPEN;
          this.logger.warn('🔄 S3 Circuit Breaker: Transitioning to HALF_OPEN, testing service recovery');
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Handle successful S3 operation
   */
  private onSuccess() {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
      this.logger.log('✅ S3 Circuit Breaker: Service recovered, circuit CLOSED');
    }
    this.failureCount = Math.max(0, this.failureCount - 1); // Gradually decrease failure count
  }

  /**
   * Handle failed S3 operation
   */
  private onFailure(error: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    this.logger.error(`❌ S3 Operation failed (${this.failureCount}/${this.circuitConfig.failureThreshold})`, error);

    if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.circuitState = CircuitState.OPEN;
      this.nextAttemptTime = this.lastFailureTime + this.circuitConfig.timeout;
      
      this.logger.error(
        `🚫 S3 Circuit Breaker: OPENED due to ${this.failureCount} failures. ` +
        `Next attempt in ${this.circuitConfig.timeout / 1000}s`
      );
    }
  }

  /**
   * Get current circuit breaker status
   */
  getCircuitStatus() {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      canExecute: this.canExecute(),
      config: this.circuitConfig
    };
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
      return { 
        status: 'healthy', 
        bucket, 
        region: this.configService.get('AWS_REGION'),
        circuitBreaker: this.getCircuitStatus()
      };
      
    } catch (error) {
      this.logger.error(`❌ S3 health check failed`, error);
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : String(error),
        circuitBreaker: this.getCircuitStatus()
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
