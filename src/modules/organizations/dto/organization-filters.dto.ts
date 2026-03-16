import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';

export class OrganizationFiltersDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  id?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  offset?: number = 0;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  deleted?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  source_partner_id?: number;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  state_id?: number;
}