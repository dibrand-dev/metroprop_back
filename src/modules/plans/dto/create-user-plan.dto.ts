import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { MercadoPagoPurchaseDto } from './mercadopago-purchase.dto';

export class CreateUserPlanDto {
  @IsInt()
  plan_id!: number;

  @IsOptional()
  @IsInt()
  user_id!: number;

  @IsInt()
  @Min(0)
  amount_hired!: number;

  @IsOptional()
  @IsDate()
  start_date!: Date;

  @IsOptional()
  @IsDate()
  end_date!: Date;

  @ValidateNested()
  @Type(() => MercadoPagoPurchaseDto)
  mercadopago!: MercadoPagoPurchaseDto;
}
