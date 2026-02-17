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
  Matches
} from 'class-validator';

export class CreatePropertyDto {
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
  @IsInt({ message: 'property_type debe ser un número entero' })
  @IsPositive({ message: 'property_type debe ser positivo' })
  property_type!: number;

  @IsNotEmpty({ message: 'status es obligatorio' })
  @IsInt({ message: 'status debe ser un número entero' })
  @IsPositive({ message: 'status debe ser positivo' })
  status!: number;

  @IsNotEmpty({ message: 'operation_type es obligatorio' })
  @IsString({ message: 'operation_type debe ser un string' })
  @MinLength(1, { message: 'operation_type no puede estar vacío' })
  operation_type!: string;

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
  @IsString()
  @MaxLength(500)
  publication_title_en?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internal_comments?: string;

  // Ubicación
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

  // Coordenadas
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

  // Características
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

  // Superficies
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
  @IsString()
  @MaxLength(10)
  surface_measurement?: string;

  // Información del inmueble
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
  @IsInt()
  @Min(0)
  floors_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zonification?: string;

  // Económica
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

  // Período (para alquileres)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  period?: string;

  // Contactos y responsables
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

  // Desarrollo
  @IsOptional()
  @IsString()
  @MaxLength(255)
  development?: string;

  // Red
  @IsOptional()
  @IsString()
  network_information?: string;

  @IsOptional()
  @IsString()
  transaction_requirements?: string;

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
