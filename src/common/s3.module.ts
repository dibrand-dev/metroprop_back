import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

/**
 * Módulo global que provee un único singleton de S3Service.
 * Al ser @Global(), S3Service queda disponible en toda la aplicación
 * sin necesidad de importar este módulo en cada feature module.
 * Esto garantiza que el circuit-breaker sea compartido por todos los módulos.
 */
@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
