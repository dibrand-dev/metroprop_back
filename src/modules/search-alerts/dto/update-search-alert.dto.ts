import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchAlertStatus } from '../entities/search-alert.entity';

export class UpdateSearchAlertDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  filters?: string; // JSON string con los filtros

  @IsEnum(SearchAlertStatus)
  @IsOptional()
  status?: SearchAlertStatus;
}
