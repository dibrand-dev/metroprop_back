import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Min,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePropertyFieldsDto } from '../../../common/dto/base-property-fields.dto';
import { CreateImageDto, CreateVideoDto, CreateMultimedia360Dto, CreateAttachedDto } from './create-property.dto';

/**
 * DTO para crear una unidad dentro de un emprendimiento.
 * Una unidad es una propiedad normal (`is_development = false`) vinculada al
 * emprendimiento padre a través de `development_id`, que se resuelve
 * automáticamente por el servidor a partir del reference_code del emprendimiento.
 */
export class CreateDevelopmentUnitDto extends BasePropertyFieldsDto {
  
  // ========== MULTIMEDIA ==========

  @ApiPropertyOptional({
    description: 'Imágenes de la unidad',
    type: () => [CreateImageDto],
  })
  @IsOptional()
  @IsArray({ message: 'images debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @ApiPropertyOptional({
    description: 'IDs de tags asociados a la unidad',
    example: [1, 3, 5],
  })
  @IsOptional()
  @IsArray({ message: 'tags debe ser un array' })
  @IsInt({ each: true, message: 'Cada tag ID debe ser un número entero' })
  @IsPositive({ each: true, message: 'Cada tag ID debe ser un número positivo' })
  @Type(() => Number)
  tags?: number[];

  @ApiPropertyOptional({
    description: 'Videos de la unidad',
    type: () => [CreateVideoDto],
  })
  @IsOptional()
  @IsArray({ message: 'videos debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateVideoDto)
  videos?: CreateVideoDto[];

  @ApiPropertyOptional({
    description: 'Tours 360 de la unidad',
    type: () => [CreateMultimedia360Dto],
  })
  @IsOptional()
  @IsArray({ message: 'multimedia360 debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateMultimedia360Dto)
  multimedia360?: CreateMultimedia360Dto[];

  @ApiPropertyOptional({
    description: 'Archivos adjuntos de la unidad (planos, PDF, etc.)',
    type: () => [CreateAttachedDto],
  })
  @IsOptional()
  @IsArray({ message: 'attached debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateAttachedDto)
  attached?: CreateAttachedDto[];

  // ========== CAMPOS INTERNOS (no exponer al partner) ==========

  /** development_id es resuelto por el servidor; no lo acepta el cliente. */
  development_id?: number;

  /** Siempre false para unidades; no lo acepta el cliente. */
  is_development?: boolean;
}
