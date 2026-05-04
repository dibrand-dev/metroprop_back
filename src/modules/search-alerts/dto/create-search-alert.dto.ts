import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSearchAlertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  filters!: string; // JSON string con los filtros
}
