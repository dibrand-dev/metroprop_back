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
  isNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyStatus, DevelopmentType, PropertyType, OperationType } from '../../../common/enums';
import { CreateImageDto, CreateVideoDto, CreateMultimedia360Dto, CreateAttachedDto } from './create-property.dto';
import { CreateDevelopmentUnitDto } from './create-development-unit.dto';

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
  @IsInt({ message: 'branch_reference_id debe ser un número entero' })
  @IsOptional()
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

  @IsNotEmpty()
  @IsEnum(PropertyType)
  property_type = PropertyType.EMPRENDIMIENTO;

  @IsNotEmpty()
  price = 0;

  @IsNotEmpty()
  @IsEnum(OperationType)
  operation_type = OperationType.VENTA;

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  // ========== Emprendimiento ==========


  @IsOptional()
  @IsBoolean()
  is_development?: boolean;

  @IsOptional()
  @IsInt()
  development_id?: number;

  @IsOptional()
  @IsEnum(DevelopmentType)
  @IsInt()
  development_type?: DevelopmentType;

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

  /**
   * Unidades del emprendimiento. Cada unidad es una propiedad hija vinculada automáticamente
   * al emprendimiento recién creado. Se procesan en el mismo request.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDevelopmentUnitDto)
  units?: CreateDevelopmentUnitDto[];
}
