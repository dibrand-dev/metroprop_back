import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class ToggleFavouriteDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  user_id!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  property_id!: number;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  status!: boolean;
}