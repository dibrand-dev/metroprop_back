import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LeadContactType, LeadState } from '@/common/enums';

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  return Number(value);
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  @MaxLength(10)
  country_code?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  property_id!: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  organization_id?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  user_id?: number;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsEnum(LeadState)
  lead_state?: LeadState;

  @IsOptional()
  @IsEnum(LeadContactType)
  contact_type?: LeadContactType;
}