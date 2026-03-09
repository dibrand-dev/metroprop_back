import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class PartnerAdministratorDto {
  @IsNotEmpty({ message: 'administrator.name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsNotEmpty({ message: 'administrator.email es obligatorio' })
  @IsEmail({}, { message: 'administrator.email debe ser un email válido' })
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'administrator.phone inválido' })
  phone?: string;
}
