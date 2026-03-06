import {
  IsArray,
  IsOptional,
  ValidateNested,
  IsString,
  IsNumber,
  IsNotEmpty,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Normaliza un array que puede contener strings u objetos.
 * Los strings se convierten en objetos usando la clave indicada.
 * Ejemplo: "https://..." → { [urlKey]: "https://..." }
 */
function normalizeStringArray<T>(value: any, urlKey: string): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    // {} vacío → [] (borrar todos)
    if (typeof value === 'object' && Object.keys(value).length === 0) return [];
    // string suelto → envolver como entrada existente
    if (typeof value === 'string') return [{ [urlKey]: value } as unknown as T];
    // objeto suelto → envolver en array
    return [value as unknown as T];
  }
  return value.map((item: any) =>
    typeof item === 'string' ? ({ [urlKey]: item } as unknown as T) : item,
  );
}
// import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para metadatos de imágenes subidas
 */
export class PropertyImageDto {
  // @ApiProperty({
  //   description: 'Posición de orden de la imagen (se asigna automáticamente si no se especifica)',
  //   minimum: 1,
  //   example: 1,
  //   required: false,
  // })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order_position?: number;

  // Si la imagen ya existe en S3, el cliente puede enviar
  // la URL completa (o la clave relativa) para indicar que no
  // debe volver a subirse. Esto también permite reordenar
  // elementos sin necesidad de reenviar archivos.
  @IsOptional()
  @IsString()
  // puede ser una URL completa o la clave relativa que usamos en S3
  // (p.ej. "properties/123/images/456-159846.jpg"). El validador se mantiene
  // simple para no causar falsos negativos.
  url?: string;
}

/**
 * DTO para videos (URLs externas como YouTube, Vimeo, etc.)
 */
export class PropertyVideoDto {
  // @ApiProperty({
  //   description: 'URL del video (YouTube, Vimeo, etc.)',
  //   example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  // })
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'La URL del video debe ser válida' })
  url!: string;

  // @ApiProperty({
  //   description: 'Orden de presentación del video (se asigna automáticamente si no se especifica)',
  //   minimum: 1,
  //   example: 1,
  //   required: false,
  // })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  // ID opcional para identificar un video existente y actualizarlo
  // en lugar de crear uno nuevo (útil si la URL cambió pero es el mismo video)
  @IsOptional()
  @IsNumber()
  id?: number;
}

/**
 * DTO para tours virtuales 360 (URLs externas)
 */
export class PropertyMultimedia360Dto {
  // @ApiProperty({
  //   description: 'URL del tour virtual 360',
  //   example: 'https://my360tour.com/property/123',
  // })
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'La URL del multimedia 360 debe ser válida' })
  url!: string;

  // @ApiProperty({
  //   description: 'Orden de presentación del tour 360 (se asigna automáticamente si no se especifica)',
  //   minimum: 1,
  //   example: 1,
  //   required: false,
  // })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  // ID opcional para identificar un multimedia360 existente y actualizarlo
  // en lugar de crear uno nuevo (útil si la URL cambió pero es el mismo tour)
  @IsOptional()
  @IsNumber()
  id?: number;
}

/**
 * DTO para archivos adjuntos (PDFs, documentos, etc.)
 */
export class PropertyAttachedDto {
  // @ApiProperty({
  //   description: 'Orden de presentación del archivo (se asigna automáticamente si no se especifica)',
  //   minimum: 1,
  //   example: 1,
  //   required: false,
  // })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  // @ApiProperty({
  //   description: 'URL del archivo si ya está subido (opcional)',
  //   required: false,
  //   example: 'https://storage.example.com/document.pdf',
  // })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'La URL del archivo debe ser válida' })
  file_url?: string;

  // @ApiProperty({
  //   description: 'Descripción del archivo adjunto',
  //   required: false,
  //   maxLength: 500,
  //   example: 'Manual de usuario de la propiedad',
  // })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;
}

/**
 * DTO principal para guardar multimedia de una propiedad
 * 
 * @description
 * Permite combinar diferentes tipos de multimedia:
 * - Videos externos (YouTube, Vimeo) con URLs
 * - Tours virtuales 360 con URLs
 * - Imágenes subidas como archivos con metadatos opcionales
 * - Archivos adjuntos (PDFs, documentos) con metadatos opcionales
 */
export class SaveMultimediaDto {
  // @ApiProperty({
  //   description: 'Metadatos de imágenes subidas (orden de presentación)',
  //   required: false,
  //   type: [PropertyImageDto],
  //   example: [{ order_position: 1 }, { order_position: 2 }],
  // })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray<PropertyImageDto>(value, 'url'))
  @ValidateNested({ each: true })
  @Type(() => PropertyImageDto)
  images?: PropertyImageDto[];

  // @ApiProperty({
  //   description: 'Videos externos con URLs y orden',
  //   required: false,
  //   type: [PropertyVideoDto],
  //   example: [
  //     { url: 'https://www.youtube.com/watch?v=video1', order: 1 },
  //     { url: 'https://www.youtube.com/watch?v=video2', order: 2 }
  //   ],
  // })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray<PropertyVideoDto>(value, 'url'))
  @ValidateNested({ each: true })
  @Type(() => PropertyVideoDto)
  videos?: PropertyVideoDto[];

  // @ApiProperty({
  //   description: 'Tours virtuales 360 con URLs y orden',
  //   required: false,
  //   type: [PropertyMultimedia360Dto],
  //   example: [
  //     { url: 'https://my360tour.com/tour1', order: 1 },
  //     { url: 'https://my360tour.com/tour2', order: 2 }
  //   ],
  // })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray<PropertyMultimedia360Dto>(value, 'url'))
  @ValidateNested({ each: true })
  @Type(() => PropertyMultimedia360Dto)
  multimedia360?: PropertyMultimedia360Dto[];

  // @ApiProperty({
  //   description: 'Metadatos de archivos adjuntos (orden y descripción)',
  //   required: false,
  //   type: [PropertyAttachedDto],
  //   example: [
  //     { order: 1, description: 'Manual de usuario' },
  //     { order: 2, description: 'Planos de la propiedad' }
  //   ],
  // })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray<PropertyAttachedDto>(value, 'file_url'))
  @ValidateNested({ each: true })
  @Type(() => PropertyAttachedDto)
  attached?: PropertyAttachedDto[];
}