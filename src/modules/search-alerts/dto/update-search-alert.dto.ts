import { AlertFrequency } from '@/common/enums';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSearchAlertDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  filters?: string; // JSON string con los filtros

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsOptional()
  @IsEnum(AlertFrequency)
  frequency?: AlertFrequency;

  @IsOptional()
  @IsInt()
  user_id?: number;
}
