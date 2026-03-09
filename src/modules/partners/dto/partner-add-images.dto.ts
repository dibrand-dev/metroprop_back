import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PartnerAddImageItemDto {
  @IsNotEmpty({ message: 'url de imagen es requerida' })
  @IsString()
  url!: string;

  @IsOptional()
  @IsBoolean()
  is_blueprint?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order_position?: number;
}

export class PartnerAddImagesDto {
  @IsArray({ message: 'images debe ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos una imagen' })
  @ValidateNested({ each: true })
  @Type(() => PartnerAddImageItemDto)
  images!: PartnerAddImageItemDto[];
}
