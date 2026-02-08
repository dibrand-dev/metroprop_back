import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreatePartnerDto {
  @IsNotEmpty({ message: 'Nombre es requerido' })
  @IsString({ message: 'Nombre debe ser un string' })
  @MinLength(2, { message: 'Nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'Nombre no puede exceder 100 caracteres' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Descripción debe ser un string' })
  @MaxLength(2000, {
    message: 'Descripción no puede exceder 2000 caracteres',
  })
  description?: string;

  @IsNotEmpty({ message: 'App Key es requerida' })
  @IsString({ message: 'App Key debe ser un string' })
  @MinLength(10, { message: 'App Key debe tener al menos 10 caracteres' })
  @MaxLength(255, { message: 'App Key no puede exceder 255 caracteres' })
  app_key!: string;

  @IsNotEmpty({ message: 'App Secret es requerida' })
  @IsString({ message: 'App Secret debe ser un string' })
  @MinLength(10, { message: 'App Secret debe tener al menos 10 caracteres' })
  @MaxLength(255, { message: 'App Secret no puede exceder 255 caracteres' })
  app_secret!: string;

  @IsOptional()
  status?: number;
}
