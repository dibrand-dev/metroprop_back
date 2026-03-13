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
  IsBoolean,
  IsEnum,
} from 'class-validator';
import {
  OperationType,
  PropertyStatus,
  PropertySubtype,
  PropertyType,
  SurfaceMeasurement,
  Brightness,
  GarageCoverage,
  PublicationPlan,
} from '../enums';

/**
 * Clase base con todos los campos compartidos de una propiedad.
 * Tanto CreatePropertyDto como PartnerCreatePropertyDto extienden esta clase.
 */
export class BasePropertyFieldsDto {
  // ========== CAMPOS OBLIGATORIOS ==========

  @IsNotEmpty({ message: 'reference_code es obligatorio' })
  @IsString({ message: 'reference_code debe ser un string' })
  @MinLength(1, { message: 'reference_code no puede estar vacío' })
  @MaxLength(100, { message: 'reference_code no puede exceder 100 caracteres' })
  reference_code!: string;

  @IsNotEmpty({ message: 'publication_title es obligatorio' })
  @IsString({ message: 'publication_title debe ser un string' })
  @MinLength(1, { message: 'publication_title no puede estar vacío' })
  @MaxLength(500, { message: 'publication_title no puede exceder 500 caracteres' })
  publication_title!: string;

  @IsNotEmpty({ message: 'property_type es obligatorio' })
  @IsEnum(PropertyType)
  property_type!: PropertyType;

  @IsNotEmpty({ message: 'status es obligatorio' })
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsNotEmpty({ message: 'operation_type es obligatorio' })
  @IsEnum(OperationType)
  operation_type!: OperationType;

  @IsNotEmpty({ message: 'price es obligatorio' })
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'price debe ser un número válido' })
  @IsPositive({ message: 'price debe ser positivo' })
  price!: number;

  @IsNotEmpty({ message: 'currency es obligatorio' })
  @IsString({ message: 'currency debe ser un string' })
  @Matches(/^[A-Z]{3}$/, { message: 'currency debe ser código ISO de 3 letras (ej: ARS, USD)' })
  currency!: string;

  // ========== CAMPOS OPCIONALES ==========

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

  // --- Información del inmueble ---
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
  @IsInt()
  @Min(0)
  apartments_per_floor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  warehouse_units?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  number_of_guests?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  business_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fot?: number;

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
  @Matches(/^[A-Z]{3}$/, { message: 'currency_expenses debe ser código ISO de 3 letras (ej: ARS, USD)' })
  currency_expenses?: string;

  @IsOptional()
  @IsString()
  commission?: string;

  @IsOptional()
  @IsString()
  network_share?: string;

  // --- Período (para alquileres) ---
  @IsOptional()
  @IsString()
  @MaxLength(50)
  period?: string;

  // --- Plan de publicación ---
  @IsOptional()
  @IsEnum(PublicationPlan)
  selected_plan?: PublicationPlan;

  // --- Precio por metro cuadrado ---
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  price_square_meter?: number;

  // --- Contactos y responsables ---
  @IsOptional()
  @IsString()
  producer_user?: string;

  @IsOptional()
  @IsInt()
  branch_id?: number;

  @IsOptional()
  @IsInt()
  user_id?: number;

  @IsOptional()
  @IsInt()
  organization_id?: number;

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
}
