import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Currency } from '../../../common/enums';

export class CreatePlanDto {
  @IsString()
  plan_name!: string;

  @IsOptional()
  @IsString()
  plan_description?: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsInt()
  @Min(0)
  visibility!: number;

  /** Max highlights/destaques (0 = unlimited) */
  @IsInt()
  @Min(0)
  highlight_limit!: number;

  @IsOptional()
  is_active?: boolean;
}
