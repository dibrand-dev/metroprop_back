import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { LeadContactType, LeadState } from '@/common/enums';

export class LeadFiltersDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  id?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  property_id?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  organization_id?: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsEnum(LeadState)
  lead_state?: LeadState;

  @IsOptional()
  @IsEnum(LeadContactType)
  contact_type?: LeadContactType;

  @IsOptional()
  @IsString()
  searchString?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  offset?: number = 0;
}