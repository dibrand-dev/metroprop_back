import {
  IsOptional,
  IsInt,
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * DTO para búsqueda avanzada de propiedades.
 *
 * Los campos que aceptan múltiples valores (bathroom_amount, room_amount, etc.)
 * se envían como valores separados por coma en query string:
 *   ?bathroom_amount=1,2,3
 *
 * Los rangos se envían como min/max:
 *   ?price_min=50000&price_max=200000
 */
export class SearchPropertiesDto {
  
  // ========== Paginación ==========

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;


  @IsOptional()
  @IsString()
  order_by?: string; // Ejemplo: "price:asc" o "created_at:desc"

  // ========== Identificadores / Organización ==========

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organization_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_id?: number;

  // ========== Ubicación ==========

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  country_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  state_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  location_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sub_location_id?: number;

  @IsOptional()
  @IsString()
  northEastLat?: string;

  @IsOptional()
  @IsString()
  northEastLng?: string;

  @IsOptional()
  @IsString()
  southWestLat?: string;

  @IsOptional()
  @IsString()
  southWestLng?: string;

  // ========== Tipo de propiedad y operación ==========

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  property_type?: number[];


  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  property_subtype?: number[];

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  operation_type?: number[];

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  // ========== Precio ==========

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_max?: number;


  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_m2_max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_m2_min?: number;

  // ========== Superficies ==========

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  roofed_surface_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  roofed_surface_max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_surface_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_surface_max?: number;

  // ========== Cantidades (multi-select) ==========

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  bathroom_amount?: number[];

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  room_amount?: number[];

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  suite_amount?: number[];

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  parking_lot_amount?: number[];

  // ========== Otros filtros ==========

  
  @IsOptional()
  @IsString()
  age?: string;

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  disposition?: number[];

  
  @IsOptional()
  @IsBoolean()
  inmobiliaria?: boolean;

  @IsOptional()
  @IsBoolean()
  direct_owner?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  orientation?: number;


  @IsOptional()
  @Transform(({ value }) => parseIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  tags?: number[];

  // ========== Texto libre ==========

  @IsOptional()
  @IsString()
  q?: string;

  // ========== Modo de respuesta ==========

  @IsOptional()
  @Transform(({ value }) => value === undefined ? true : (value === 'true' || value === true || value === '1' || value === 1))
  @IsBoolean()
  card?: boolean = true;


  @IsOptional()
  @Transform(({ value }) => value === undefined ? false : (value === 'true' || value === true || value === '1' || value === 1))
  @IsBoolean()
  full?: boolean = false;

  @IsOptional()
  @IsString()
  polygon?: string;
}

/**
 * Convierte "1,2,3" o ["1","2","3"] o [1,2,3] a number[].
 */
function parseIntArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => parseInt(String(v), 10)).filter((n) => !isNaN(n));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => !isNaN(n));
  }
  if (typeof value === 'number') {
    return [value];
  }
  return [];
}
