import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ToggleFavouriteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  user_id?: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  property_id!: number;
}