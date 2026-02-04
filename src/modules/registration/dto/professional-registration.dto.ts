import { IsEmail, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

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

  @IsNotEmpty()
  company_name!: string;

  @IsNotEmpty()
  social_reason!: string;

  @IsOptional()
  cuit?: string;

  @IsOptional()
  fiscal_condition?: string;
}
