import { IsString, IsOptional, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { TagType } from '../../../common/enums';

export class CreateTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(TagType)
  type!: TagType;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}