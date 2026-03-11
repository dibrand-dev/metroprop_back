import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  IsEnum,
  IsPositive,
} from 'class-validator';
import { ProfessionalType } from '../enums';

export class BaseOrganizationFieldsDto {
  @IsNotEmpty({ message: 'company_name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  company_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  company_logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternative_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_time?: string;

  @IsOptional()
  @IsEnum(ProfessionalType)
  professional_type?: ProfessionalType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d$/, { message: 'cuit debe tener formato XX-XXXXXXXX-X' })
  cuit?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email debe ser válido' })
  @MaxLength(255)
  email?: string;

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
  sublocation_id?: number;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  full_location?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  geo_lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  geo_long?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  social_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscal_condition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adminUserId?: number;
}
