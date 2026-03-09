import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  IsPositive,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PropertyStatus,
  PropertySubtype,
  PropertyType,
  SurfaceMeasurement,
  Brightness,
  GarageCoverage,
} from '../../../common/enums';
import { PartnerOperationDto } from './partner-create-property.dto';

/**
 * DTO para actualización parcial de propiedad via Partner API.
 * NO incluye company, administrator, ni multimedia (se gestionan por endpoints separados).
 * Todos los campos son opcionales.
 */
export class PartnerUpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  publication_title?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  property_type?: PropertyType;

  @IsOptional()
  @IsEnum(PropertySubtype)
  property_subtype?: PropertySubtype;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Si se envía operations, debe incluir al menos una' })
  @ValidateNested({ each: true })
  @Type(() => PartnerOperationDto)
  operations?: PartnerOperationDto[];

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

  // --- Tags ---
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  tags?: number[];
}
