import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { Currency, PlanName } from '../../../common/enums';

export class CreatePlanDto {
  @IsEnum(PlanName)
  plan_type!: PlanName;

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
