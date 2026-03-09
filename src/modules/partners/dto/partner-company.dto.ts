import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class PartnerCompanyDto {
  @IsNotEmpty({ message: 'company.reference_id es obligatorio' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reference_id!: string;

  @IsNotEmpty({ message: 'company.company_name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  company_name!: string;

  @IsNotEmpty({ message: 'company.email es obligatorio' })
  @IsEmail({}, { message: 'company.email debe ser un email válido' })
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'company.phone inválido' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'company.alternative_phone inválido' })
  alternative_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d$/, { message: 'company.cuit debe tener formato XX-XXXXXXXX-X' })
  cuit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscal_condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  social_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  professional_type?: string;

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
}
