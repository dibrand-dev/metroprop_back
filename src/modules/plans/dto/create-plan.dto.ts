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

  @IsInt()
  @Min(0)
  price!: number;

  @IsEnum(Currency)
  currency!: Currency;

  /** Max properties (0 = unlimited) */
  @IsInt()
  @Min(0)
  property_limit!: number;

  /** Max highlights/destaques (0 = unlimited) */
  @IsInt()
  @Min(0)
  highlight_limit!: number;

  @IsOptional()
  is_active?: boolean;
}
