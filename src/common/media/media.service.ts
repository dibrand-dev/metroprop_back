import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import axios from 'axios';
import sharp from 'sharp';

import { S3Service } from '../s3.service';
import { IMAGE_SIZES, ImageSizeKey } from '../constants';

/**
 * Servicio centralizado para todas las operaciones de media (imágenes y archivos).
 *
 * Responsabilidades:
 * - Construcción de S3 keys consistentes
 * - Compresión de imágenes con multi-tamaño (WebP)
 * - Upload de archivos genéricos a S3
 * - Upload de imágenes con múltiples tamaños (para propiedades)
 * - Upload de imagen única asociada a una entidad (para logos/avatares)
 * - Descarga de archivos desde URLs externas
 *
 * Los módulos sólo deben importar MediaModule para acceder a este servicio.
 * S3Service llega por inyección desde el S3Module global.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  // =========================================================
  // PATH HELPERS
  // =========================================================

  /** Prefijo de path según ambiente (vacío en producción, "localhost/" en desarrollo) */
  getPathPrefix(): string {
    return this.configService.get('NODE_ENV') === 'production' ? '' : 'localhost/';
  }

  /**
   * Construye un S3 key consistente para cualquier tipo de archivo.
   * @param folder  Carpeta destino, ej: "properties/42/images" o "users"
   * @param filename Nombre del archivo, ej: "123-timestamp.webp"
   */
  buildS3Key(folder: string, filename: string): string {
    return `${this.getPathPrefix()}${folder}/${filename}`;
  }

  /**
   * Construye la URL pública completa de un objeto en S3 a partir de su key.
   * Centraliza la lógica bucket+region para que los módulos no la dupliquen.
   */
  buildPublicUrl(key: string): string {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  // =========================================================
  // S3 UPLOAD (raw)
  // =========================================================

  /** Upload directo de un buffer a S3. */
  async uploadFile(buffer: Buffer, key: string, mimetype: string): Promise<void> {
    await this.s3Service.uploadFile(buffer, key, mimetype);
  }

  // =========================================================
  // IMAGE COMPRESSION
  // =========================================================

  /**
   * Comprime una imagen y genera todos los tamaños definidos en IMAGE_SIZES.
   * Convierte a WebP para máxima compresión sin pérdida perceptible.
   * SVG y GIF se devuelven sin procesar.
   */
  async compressImage(
    buffer: Buffer,
    originalMimetype: string,
  ): Promise<{ buffers: Record<ImageSizeKey, Buffer>; mimetype: string }> {
    const SKIP_TYPES = ['image/svg+xml', 'image/gif'];

    if (SKIP_TYPES.includes(originalMimetype)) {
      const buffers = {} as Record<ImageSizeKey, Buffer>;
      for (const key of Object.keys(IMAGE_SIZES) as ImageSizeKey[]) {
        buffers[key] = buffer;
      }
      return { buffers, mimetype: originalMimetype };
    }

    const buffers = {} as Record<ImageSizeKey, Buffer>;
    for (const [key, config] of Object.entries(IMAGE_SIZES) as Array<[ImageSizeKey, { width: number; prefix: string }]>) {
      buffers[key] = await sharp(buffer)
        .rotate()                                                   // auto-corregir orientación EXIF
        .resize({ width: config.width, withoutEnlargement: true }) // no agrandar imágenes pequeñas
        .webp({ quality: 82 })
        .toBuffer();
    }

    return { buffers, mimetype: 'image/webp' };
  }

  // =========================================================
  // ENTITY IMAGE UPLOAD (logos, avatares - imagen única)
  // =========================================================

  /**
   * Sube una imagen a S3 y actualiza el campo correspondiente en la entidad.
   * Usado por users, organizations, branches y partners para logos y avatares.
   *
   * @param file            Archivo recibido del cliente
   * @param config.repository     Repositorio TypeORM de la entidad
   * @param config.entityId       ID de la entidad a actualizar
   * @param config.imageFieldName Campo de la entidad donde guardar la URL
   * @param config.statusFieldName Campo de estado (se limpia en éxito, recibe error en fallo)
   * @param config.s3Folder       Carpeta S3 destino, ej: "users" o "organizations"
   */
  async uploadEntityImage(
    file: Express.Multer.File,
    config: {
      repository: Repository<any>;
      entityId: number;
      imageFieldName: string;
      statusFieldName?: string;
      s3Folder: string;
    },
  ): Promise<{ url: string | null; key: string }> {
    const { repository, entityId, imageFieldName, statusFieldName, s3Folder } = config;

    const entity = await repository.findOne({ where: { id: entityId } });
    if (!entity) {
      throw new NotFoundException(`Entity with id ${entityId} not found.`);
    }

    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = this.buildS3Key(s3Folder, `${entityId}/${timestamp}.${ext}`);

    try {
      await this.s3Service.uploadFile(file.buffer, key, file.mimetype);

      const update: Record<string, any> = { [imageFieldName]: key };
      if (statusFieldName) update[statusFieldName] = null;
      await repository.update(entityId, update);

      return { url: key, key };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'S3 upload failed';
      if (statusFieldName) {
        await repository.update(entityId, { [statusFieldName]: errorMsg });
      }
      return { url: null, key };
    }
  }

  // =========================================================
  // MULTI-SIZE IMAGE UPLOAD (imágenes de propiedades)
  // =========================================================

  /**
   * Comprime y sube una imagen en todos los tamaños de IMAGE_SIZES en paralelo.
   * Acepta un archivo directo o una URL externa para descargar primero.
   * Retorna un mapa de tamaño → S3 key.
   *
   * El cliente puede derivar la URL del thumb anteponiendo THUMB_PREFIX
   * al nombre de archivo del tamaño FULL.
   *
   * @param source   Fuente de la imagen (archivo o URL)
   * @param folder   Carpeta destino en S3, ej: "properties/42/images"
   * @param fileId   ID del registro (usado para nombrar el archivo)
   */
  async uploadImageWithSizes(
    source: { file?: Express.Multer.File; originalUrl?: string },
    folder: string,
    fileId: number,
  ): Promise<Record<ImageSizeKey, string>> {
    let rawBuffer: Buffer;
    let originalMimetype: string;
    let originalName: string;

    if (source.originalUrl) {
      const response = await axios.get(source.originalUrl, { responseType: 'arraybuffer' });
      rawBuffer = Buffer.from(response.data, 'binary');
      originalMimetype = response.headers['content-type'] || 'image/jpeg';
      originalName = `${fileId}.${originalMimetype.split('/')[1] || 'jpg'}`;
    } else if (source.file) {
      rawBuffer = source.file.buffer;
      originalMimetype = source.file.mimetype;
      originalName = source.file.originalname;
    } else {
      throw new Error('Debe proporcionar un archivo o una URL original.');
    }

    const { buffers, mimetype: outputMimetype } = await this.compressImage(rawBuffer, originalMimetype);
    const outputExt = outputMimetype === 'image/webp' ? 'webp' : (originalName.split('.').pop() || 'jpg');
    const baseFilename = `${fileId}-${Date.now()}.${outputExt}`;

    const uploadTasks = (Object.entries(IMAGE_SIZES) as Array<[ImageSizeKey, { width: number; prefix: string }]>).map(
      ([sizeKey, sizeConfig]) => {
        const filename = `${sizeConfig.prefix}${baseFilename}`;
        const s3Key = this.buildS3Key(folder, filename);
        return this.s3Service.uploadFile(buffers[sizeKey], s3Key, outputMimetype).then(() => {
          this.logger.log(`✅ Uploaded ${sizeKey} (${sizeConfig.width}px) fileId=${fileId}: ${s3Key}`);
          return { sizeKey, s3Key };
        });
      },
    );

    const uploadedSizes = await Promise.all(uploadTasks);

    const keys = {} as Record<ImageSizeKey, string>;
    for (const { sizeKey, s3Key } of uploadedSizes) {
      keys[sizeKey] = s3Key;
    }
    return keys;
  }

  // =========================================================
  // FILE DOWNLOAD FROM URL
  // =========================================================

  /**
   * Descarga un archivo desde una URL externa.
   * @returns Buffer del archivo, nombre de archivo y mimetype detectado
   */
  async downloadFromUrl(url: string): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      validateStatus: (status) => status < 400,
    });

    const buffer = Buffer.from(response.data);
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const filename = lastPart.includes('.') ? lastPart.split('?')[0] : 'file';
    const mimetype = response.headers['content-type'] || 'application/octet-stream';

    return { buffer, filename, mimetype };
  }

  // =========================================================
  // S3 HEALTH
  // =========================================================

  /** Expone el health check de S3 y el estado del circuit-breaker. */
  async getS3Status() {
    return this.s3Service.healthCheck();
  }
}
