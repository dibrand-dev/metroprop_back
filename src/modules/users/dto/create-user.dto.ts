import { 
  IsEmail, 
  IsNotEmpty, 
  MinLength, 
  MaxLength,
  IsOptional, 
  IsInt, 
  Min, 
  IsArray,
  IsString,
  IsEnum,
  Matches,
  ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../common/enums';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Nombre es requerido' })
  @IsString({ message: 'Nombre debe ser un string' })
  @MinLength(2, { message: 'Nombre debe tener al menos 2 caracteres' })
  @MaxLength(255, { message: 'Nombre no puede exceder 255 caracteres' })
  name!: string;

  @IsOptional()
  @IsString()
  google_id?: string;

  @IsEmail({}, { message: 'Email debe ser válido' })
  @IsNotEmpty({ message: 'Email es requerido' })
  @MaxLength(255, { message: 'Email no puede exceder 255 caracteres' })
  email!: string;

  @IsNotEmpty({ message: 'Contraseña es requerida' })
  @MinLength(6, { message: 'Contraseña debe tener al menos 6 caracteres' })
  @MaxLength(255, { message: 'Contraseña no puede exceder 255 caracteres' })
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'Teléfono debe ser válido' 
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'Teléfono debe ser válido' 
  })
  phone_additional?: string;


  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'Teléfono debe ser válido' 
  })
  phone_whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  document?: string;

  @IsOptional()
  @IsInt({ message: 'ID de organización debe ser un número' })
  @Min(1, { message: 'ID de organización debe ser mayor a 0' })
  organizationId?: number; 

  @IsOptional()
  @IsArray({ message: 'IDs de sucursales debe ser un array' })
  @Type(() => Number)
  @ValidateIf(o => Array.isArray(o.branchIds))
  branchIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsEnum(UserRole, {
    message:
      'role_id debe ser uno de: 1 (ADMIN), 2 (SELLER), 3 (COLLABORATOR), 4 (SUPER_ADMIN)',
  })
  role_id?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  external_reference?: string;
}

