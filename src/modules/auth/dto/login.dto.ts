import { 
  IsEmail, 
  IsNotEmpty, 
  MinLength,
  MaxLength,
  IsString
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email debe ser un email válido' })
  @IsNotEmpty({ message: 'Email es requerido' })
  @MaxLength(255, { message: 'Email no puede exceder 255 caracteres' })
  email!: string;

  @IsNotEmpty({ message: 'Contraseña es requerida' })
  @IsString({ message: 'Contraseña debe ser un string' })
  @MinLength(6, { message: 'Contraseña debe tener al menos 6 caracteres' })
  @MaxLength(255, { message: 'Contraseña no puede exceder 255 caracteres' })
  password!: string;
}
