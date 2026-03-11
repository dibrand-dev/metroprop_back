import {
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Min,
  IsArray,
  ValidateNested,
  IsString,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BasePropertyFieldsDto } from '../../../common/dto/base-property-fields.dto';

// ========== Sub-DTOs ==========

export class PartnerVideoDto {
  @IsNotEmpty({ message: 'url de video es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PartnerMultimedia360Dto {
  @IsNotEmpty({ message: 'url de multimedia 360 es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

// ========== Main DTO ==========

export class PartnerCreatePropertyDto extends BasePropertyFieldsDto {
  // ========== ORGANIZATION / BRANCH REFERENCE ==========

  @IsNotEmpty({ message: 'branch_reference_id es obligatorio' })
  @IsInt({ message: 'branch_reference_id debe ser un número entero' })
  @IsPositive()
  branch_reference_id!: number;

  // ========== MULTIMEDIA ==========

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerVideoDto)
  videos?: PartnerVideoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerMultimedia360Dto)
  multimedia360?: PartnerMultimedia360Dto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Type(() => Number)
  tags?: number[];

  // ========== AGENT (optional) ==========

  @IsOptional()
  @IsEmail({}, { message: 'agent_email debe ser un email válido' })
  @IsString()
  agent_email?: string;

  @IsOptional()
  @IsString()
  agent_name?: string;
}
