import { FiscalCondition } from '@/common/enums';
import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';

export class ProfessionalRegistrationDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  document?: string;

  @IsNotEmpty()
  company_name!: string;

  @IsNotEmpty()
  social_reason!: string;

  @IsOptional()
  cuit?: string;

  @IsOptional()
  @IsEnum(FiscalCondition)
  fiscal_condition?: FiscalCondition;
}
