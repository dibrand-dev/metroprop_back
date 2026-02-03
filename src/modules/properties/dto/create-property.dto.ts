import { IsNotEmpty, IsNumber, IsEnum, IsOptional, IsArray, IsString } from 'class-validator';

export class CreatePropertyDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsString()
  address!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  state!: string;

  @IsNotEmpty()
  @IsString()
  zipCode!: string;

  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @IsNotEmpty()
  @IsNumber()
  area!: number;

  @IsNotEmpty()
  @IsNumber()
  bedrooms!: number;

  @IsNotEmpty()
  @IsNumber()
  bathrooms!: number;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsEnum(['apartment', 'house', 'land', 'commercial'])
  propertyType!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
