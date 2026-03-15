import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BaseOrganizationFieldsDto } from '../../../common/dto/base-organization-fields.dto';

export class PartnerCreateOrganizationDto extends BaseOrganizationFieldsDto {


  // ========== Admin User ==========

  @IsNotEmpty({ message: 'admin_name es obligatorio' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  admin_name!: string;

  @IsNotEmpty({ message: 'admin_email es obligatorio' })
  @IsEmail({}, { message: 'admin_email debe ser un email válido' })
  @MaxLength(255)
  admin_email!: string;

  @IsOptional()
  @IsString()
  admin_phone?: string;

  @IsOptional()
  @IsString()
  admin_avatar?: string;
}
