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
import { Type } from 'class-transformer';
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
  @ValidateNested({ each: true })
  @Type(() => PropertyAttachedDto)
  attached?: PropertyAttachedDto[];
}