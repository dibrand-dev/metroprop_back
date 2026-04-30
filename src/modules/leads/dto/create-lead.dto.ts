import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  @MaxLength(10)
  country_code?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  property_id!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  organization_id!: number;
}