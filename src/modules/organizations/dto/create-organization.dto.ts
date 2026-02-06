import { 
  IsEmail, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsInt, 
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
  IsNumber
} from 'class-validator';

export class CreateOrganizationDto {
  @IsOptional()
  @IsString()
  company_logo?: string;

  @IsNotEmpty({ message: 'Nombre de empresa es requerido' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  company_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Teléfono inválido' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Teléfono alternativo inválido' })
  alternative_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_time?: string;

  @IsEmail({}, { message: 'Email debe ser válido' })
  @IsNotEmpty({ message: 'Email es requerido' })
  @MaxLength(255)
  email!: string;

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
  @MaxLength(100)
  professional_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  social_reason?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d$/, { message: 'CUIT debe tener formato XX-XXXXXXXX-X' })
  cuit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscal_condition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adminUserId?: number;
}
