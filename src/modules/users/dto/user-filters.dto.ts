import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';

export class UserFiltersDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  id?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  offset?: number = 0;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_verified?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  deleted?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  organization_id?: number;
}