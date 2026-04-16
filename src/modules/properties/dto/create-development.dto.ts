import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Min,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyStatus } from '../../../common/enums';
import { CreateImageDto, CreateVideoDto, CreateMultimedia360Dto, CreateAttachedDto } from './create-property.dto';

export class CreateDevelopmentDto {
  // ========== Identificadores ==========
  @IsNotEmpty({ message: 'reference_code es obligatorio' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference_code!: string;

  @IsNotEmpty({ message: 'publication_title es obligatorio' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  publication_title!: string;

  // ========== Partner API: Branch Reference ==========
  @IsOptional()
  @IsInt({ message: 'branch_reference_id debe ser un número entero' })
  @IsPositive()
  branch_reference_id?: number;

  // ========== Organización / Sucursal / Usuario ==========
  @IsOptional()
  @IsInt()
  @IsPositive()
  organization_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  branch_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  user_id?: number;

  // ========== Estado ==========
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  // ========== Descripción ==========
  @IsOptional()
  @IsString()
  description?: string;

  // ========== Ubicación ==========
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @IsOptional()
  @IsInt()
  country_id?: number;

  @IsOptional()
  @IsInt()
  state_id?: number;

  @IsOptional()
  @IsInt()
  location_id?: number;

  @IsOptional()
  @IsInt()
  sub_location_id?: number;

  @IsOptional()
  @IsNumber()
  geo_lat?: number;

  @IsOptional()
  @IsNumber()
  geo_long?: number;

  @IsOptional()
  @IsBoolean()
  show_exact_location?: boolean;

  // ========== Características ==========
  @IsOptional()
  @IsInt()
  @Min(0)
  suite_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  room_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bathroom_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  toilet_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  parking_lot_amount?: number;

  // ========== Emprendimiento ==========
  @IsOptional()
  @IsInt()
  development_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  development_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  development_logo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  development_units_total?: number;

  @IsOptional()
  @IsDateString()
  development_delivery_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  development_available_unit_count?: number;

  // ========== Multimedia / Relaciones ==========
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  tags?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVideoDto)
  videos?: CreateVideoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMultimedia360Dto)
  multimedia360?: CreateMultimedia360Dto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttachedDto)
  attached?: CreateAttachedDto[];
}
