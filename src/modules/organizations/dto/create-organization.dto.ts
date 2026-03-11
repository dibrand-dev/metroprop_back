import { 
  IsEmail, 
  IsNotEmpty, 
  MaxLength,
} from 'class-validator';
import { BaseOrganizationFieldsDto } from '../../../common/dto/base-organization-fields.dto';

export class CreateOrganizationDto extends BaseOrganizationFieldsDto {

  @IsEmail({}, { message: 'Email debe ser válido' })
  @IsNotEmpty({ message: 'Email es requerido' })
  @MaxLength(255)
  email!: string;
}
