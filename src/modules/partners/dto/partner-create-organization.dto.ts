import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsInt,
  IsPositive,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ProfessionalType } from '../../../common/enums';

export class PartnerCreateOrganizationDto {
  // ========== Organization ==========

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

  @IsNotEmpty({ message: 'contact_email es obligatorio' })
  @IsEmail({}, { message: 'contact_email debe ser un email válido' })
  @MaxLength(255)
  contact_email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_time?: string;

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
  location_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sublocation_id?: number;

  @IsOptional()
  @IsEnum(ProfessionalType, { message: 'professional_type debe ser: inmobiliario, inversor, otros' })
  professional_type?: ProfessionalType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d$/, { message: 'cuit debe tener formato XX-XXXXXXXX-X' })
  cuit?: string;

  // ========== Admin User ==========

  @IsNotEmpty({ message: 'admin_name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  admin_name!: string;

  @IsNotEmpty({ message: 'admin_email es obligatorio' })
  @IsEmail({}, { message: 'admin_email debe ser un email válido' })
  @MaxLength(255)
  admin_email!: string;

  @IsOptional()
  @IsString()
  admin_phone?: string;
}
