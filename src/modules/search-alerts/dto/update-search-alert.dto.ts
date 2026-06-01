import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
