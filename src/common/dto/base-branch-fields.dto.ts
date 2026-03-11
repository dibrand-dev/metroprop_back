import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  IsPositive,
  Max,
  Min,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class BaseBranchFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  branch_logo?: string;

  @IsNotEmpty({ message: 'branch_name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  branch_name!: string;

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

  @IsNotEmpty({ message: 'email es obligatorio' })
  @IsEmail({}, { message: 'email debe ser válido' })
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  location_id?: string;

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
  @IsInt()
  @IsPositive()
  organizationId?: number;
}
