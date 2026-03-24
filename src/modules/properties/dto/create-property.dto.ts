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
import { BasePropertyFieldsDto } from '../../../common/dto/base-property-fields.dto';

export class CreatePropertyDto extends BasePropertyFieldsDto {
    // ========== ORGANIZATION / BRANCH REFERENCE (para Partner API) ========== 
    @IsOptional()
    @IsInt({ message: 'branch_reference_id debe ser un número entero' })
    @IsPositive()
    branch_reference_id?: number;
  // ========== RELACIONES OPCIONALES ==========

  @IsOptional()
  @IsArray({ message: 'images debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @IsOptional()
  @IsArray({ message: 'tags debe ser un array' })
  @IsInt({ each: true, message: 'Cada tag ID debe ser un número entero' })
  @IsPositive({ each: true, message: 'Cada tag ID debe ser un número positivo' })
  @Type(() => Number)
  tags?: number[];

  @IsOptional()
  @IsArray({ message: 'videos debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateVideoDto)
  videos?: CreateVideoDto[];

  @IsOptional()
  @IsArray({ message: 'multimedia360 debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateMultimedia360Dto)
  multimedia360?: CreateMultimedia360Dto[];

  @IsOptional()
  @IsArray({ message: 'attached debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateAttachedDto)
  attached?: CreateAttachedDto[];

  // ========== CAMPOS PARA PARTNER API ========== 
  @IsOptional()
  @IsEmail({}, { message: 'agent_email debe ser un email válido' })
  @IsString()
  agent_email?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;
}

// ========== DTOs PARA RELACIONES ==========

export class CreateImageDto {
  @IsNotEmpty({ message: 'URL de imagen es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsBoolean()
  is_blueprint?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order_position?: number;
}

export class CreateVideoDto {
  @IsNotEmpty({ message: 'URL de video es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateMultimedia360Dto {
  @IsNotEmpty({ message: 'URL de multimedia 360 es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateAttachedDto {
  @IsNotEmpty({ message: 'URL de archivo adjunto es requerida' })
  @IsString()
  file_url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
