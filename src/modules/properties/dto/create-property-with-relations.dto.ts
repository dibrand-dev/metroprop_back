import { Type } from 'class-transformer';
import { IsArray, ValidateNested, IsOptional } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';

export class CreateImageDto {
  @IsOptional()
  url!: string;

  @IsOptional()
  is_blueprint?: boolean;

  @IsOptional()
  description?: string;

  @IsOptional()
  order_position?: number;
}

export class CreateTagDto {
  tag_id!: number;
  tag_name!: string;
  tag_type!: number;
}

export class CreateOperationDto {
  operation_type!: string;
  currency!: string;
  price!: number;

  @IsOptional()
  period?: string;
}

export class CreatePropertyWithRelationsDto extends CreatePropertyDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTagDto)
  tags?: CreateTagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOperationDto)
  operations?: CreateOperationDto[];
}
