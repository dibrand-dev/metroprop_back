import { IsString } from 'class-validator';

export class ReferenceCodeParamDto {
  @IsString()
  reference_code!: string;
}