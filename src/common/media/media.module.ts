import { Module } from '@nestjs/common';
import { MediaService } from './media.service';

/**
 * Módulo de media. Exporta MediaService para todos los feature modules.
 *
 * S3Service NO se declara aquí porque viene del S3Module global (importado en AppModule).
 * ConfigService tampoco se declara porque viene del ConfigModule global.
 *
 * Uso en feature modules:
 *   imports: [MediaModule]   → da acceso a MediaService via inyección de dependencias
 */
@Module({
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
