import { IsEmail, IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateOrganizationDto {
  @IsOptional()
  @IsString()
  company_logo?: string;

  @IsNotEmpty()
  @IsString()
  company_name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternative_phone?: string;

  @IsOptional()
  @IsString()
  contact_time?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  full_location?: string;

  @IsOptional()
  @IsString()
  geo_lat?: string;

  @IsOptional()
  @IsString()
  geo_long?: string;

  @IsOptional()
  @IsString()
  professional_type?: string;

  @IsOptional()
  @IsString()
  social_reason?: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  fiscal_condition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adminUserId?: number;
}
