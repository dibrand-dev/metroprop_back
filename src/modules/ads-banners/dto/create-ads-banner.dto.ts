import { IsArray, IsEnum, IsOptional, IsBoolean, ArrayMinSize, IsString, MaxLength, MinLength, IsNumber } from 'class-validator';
import { BannerPlacement } from '../../../common/enums';
import { Transform } from 'class-transformer';

export class CreateAdsBannerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

 
  @IsNumber()
  @IsEnum(BannerPlacement)
  placements!: BannerPlacement;

  @IsString()
  link!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;
}
