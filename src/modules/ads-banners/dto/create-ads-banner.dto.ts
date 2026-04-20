import { IsArray, IsEnum, IsOptional, IsBoolean, ArrayMinSize, IsString, MaxLength, MinLength } from 'class-validator';
import { BannerPlacement } from '../../../common/enums';
import { Transform } from 'class-transformer';

export class CreateAdsBannerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  /**
   * Array de placements seleccionados. Llega como JSON string "[1,2]"
   * en multipart/form-data, se parsea a array automáticamente.
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(BannerPlacement, { each: true })
  placements!: BannerPlacement[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  status?: boolean;
}
