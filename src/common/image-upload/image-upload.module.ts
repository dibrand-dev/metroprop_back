import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';

/**
 * ImageUploadModule ahora es un thin re-export de MediaModule.
 * Se mantiene para compatibilidad con los módulos que ya lo importan.
 * Todos los feature modules que importan ImageUploadModule tienen acceso
 * automáticamente a MediaService sin necesidad de cambiar sus imports.
 */
@Module({
  imports: [MediaModule],
  exports: [MediaModule],
})
export class ImageUploadModule {}
