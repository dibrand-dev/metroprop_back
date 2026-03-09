import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PartnerAddAttachedItemDto {
  @IsNotEmpty({ message: 'file_url de adjunto es requerida' })
  @IsString()
  file_url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PartnerAddAttachedDto {
  @IsArray({ message: 'attached debe ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un adjunto' })
  @ValidateNested({ each: true })
  @Type(() => PartnerAddAttachedItemDto)
  attached!: PartnerAddAttachedItemDto[];
}
