import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsPositive,
  Min,
  Max,
  Matches,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OperationType,
  PropertyStatus,
  PropertySubtype,
  PropertyType,
  SurfaceMeasurement,
  Brightness,
  GarageCoverage,
} from '../../../common/enums';
import { PartnerCompanyDto } from './partner-company.dto';
import { PartnerAdministratorDto } from './partner-administrator.dto';

// ========== Sub-DTOs ==========

export class PartnerOperationDto {
  @IsNotEmpty({ message: 'operation_type es requerido' })
  @IsString()
  operation_type!: string;

  @IsNotEmpty({ message: 'currency es requerido' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency debe ser código ISO de 3 letras' })
  currency!: string;

  @IsNotEmpty({ message: 'price es requerido' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  period?: string;
}

export class PartnerImageDto {
  @IsNotEmpty({ message: 'url de imagen es requerida' })
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

export class PartnerVideoDto {
  @IsNotEmpty({ message: 'url de video es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PartnerMultimedia360Dto {
  @IsNotEmpty({ message: 'url de multimedia 360 es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PartnerAttachedDto {
  @IsNotEmpty({ message: 'file_url de adjunto es requerida' })
  @IsString()
  file_url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

// ========== Main DTO ==========

export class PartnerCreatePropertyDto {
  // ========== COMPANY & ADMINISTRATOR ==========

  @IsNotEmpty({ message: 'company es obligatorio' })
  @ValidateNested()
  @Type(() => PartnerCompanyDto)
  company!: PartnerCompanyDto;

  @IsNotEmpty({ message: 'administrator es obligatorio' })
  @ValidateNested()
  @Type(() => PartnerAdministratorDto)
  administrator!: PartnerAdministratorDto;

  // ========== REQUIRED PROPERTY FIELDS ==========

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

  @IsNotEmpty({ message: 'property_type es obligatorio' })
  @IsEnum(PropertyType)
  property_type!: PropertyType;

  @IsNotEmpty({ message: 'status es obligatorio' })
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsArray({ message: 'operations debe ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos una operación' })
  @ValidateNested({ each: true })
  @Type(() => PartnerOperationDto)
  operations!: PartnerOperationDto[];

  // ========== OPTIONAL PROPERTY FIELDS ==========

  @IsOptional()
  @IsEnum(PropertySubtype)
  property_subtype?: PropertySubtype;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publication_title_en?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internal_comments?: string;

  // --- Ubicación ---
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
  @IsPositive()
  location_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  country_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  state_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sub_location_id?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  geo_lat?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  geo_long?: number;

  @IsOptional()
  @IsBoolean()
  show_exact_location?: boolean;

  // --- Características ---
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

  // --- Superficies ---
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  surface?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  roofed_surface?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  unroofed_surface?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  semiroofed_surface?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  total_surface?: number;

  @IsOptional()
  @IsEnum(SurfaceMeasurement)
  surface_measurement?: SurfaceMeasurement;

  @IsOptional()
  @IsEnum(SurfaceMeasurement)
  roofed_surface_measurement?: SurfaceMeasurement;

  // --- Info del inmueble ---
  @IsOptional()
  @IsInt()
  @Min(-1)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  property_condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  situation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dispositions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  orientation?: string;

  @IsOptional()
  @IsEnum(Brightness)
  brightness?: Brightness;

  @IsOptional()
  @IsEnum(GarageCoverage)
  garage_coverage?: GarageCoverage;

  @IsOptional()
  @IsInt()
  @Min(0)
  surface_front?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  surface_length?: number;

  @IsOptional()
  @IsBoolean()
  credit_eligible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  floors_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zonification?: string;

  // --- Económica ---
  @IsOptional()
  @IsInt()
  @Min(0)
  expenses?: number;

  @IsOptional()
  @IsString()
  commission?: string;

  @IsOptional()
  @IsString()
  network_share?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  price_square_meter?: number;

  // --- Contactos y responsables ---
  @IsOptional()
  @IsString()
  producer_user?: string;

  @IsOptional()
  @IsString()
  key_contact?: string;

  @IsOptional()
  @IsString()
  key_agent_user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  key_location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  key_reference_code?: string;

  @IsOptional()
  @IsString()
  maintenance_user?: string;

  // --- Desarrollo ---
  @IsOptional()
  @IsString()
  @MaxLength(255)
  development?: string;

  // --- Red ---
  @IsOptional()
  @IsString()
  network_information?: string;

  @IsOptional()
  @IsString()
  transaction_requirements?: string;

  // --- Propietario ---
  @IsOptional()
  @IsString()
  @MaxLength(255)
  owner_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  owner_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  owner_email?: string;

  // --- Otros ---
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  construction_year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  last_renovation?: string;

  // ========== MULTIMEDIA ==========

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerImageDto)
  images?: PartnerImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerVideoDto)
  videos?: PartnerVideoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerMultimedia360Dto)
  multimedia360?: PartnerMultimedia360Dto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerAttachedDto)
  attached?: PartnerAttachedDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  tags?: number[];
}
