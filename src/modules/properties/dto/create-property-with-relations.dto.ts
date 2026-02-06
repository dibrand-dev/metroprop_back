import { Type } from 'class-transformer';
import { 
  IsArray, 
  ValidateNested, 
  IsOptional,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsPositive
} from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';

export class CreateImageDto {
  @IsNotEmpty({ message: 'URL de imagen es requerida' })
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

export class CreateTagDto {
  @IsNotEmpty({ message: 'Tag ID es requerido' })
  @IsInt()
  @IsPositive()
  tag_id!: number;

  @IsNotEmpty({ message: 'Nombre de tag es requerido' })
  @IsString()
  tag_name!: string;

  @IsNotEmpty({ message: 'Tipo de tag es requerido' })
  @IsInt()
  @Min(1)
  @Max(3)
  tag_type!: number; // 1=servicios, 2=ambientes, 3=adicionales
}

export class CreateOperationDto {
  @IsNotEmpty({ message: 'Tipo de operación es requerido' })
  @IsString()
  operation_type!: string; // venta, alquiler

  @IsNotEmpty({ message: 'Moneda es requerida' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Moneda debe ser código ISO' })
  currency!: string;

  @IsNotEmpty({ message: 'Precio es requerido' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  period?: string; // ej: "mensual", "anual"
}

export class CreatePropertyWithRelationsDto extends CreatePropertyDto {
  @IsOptional()
  @IsArray({ message: 'Images debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @IsOptional()
  @IsArray({ message: 'Tags debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateTagDto)
  tags?: CreateTagDto[];

  @IsOptional()
  @IsArray({ message: 'Operations debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => CreateOperationDto)
  operations?: CreateOperationDto[];
}
