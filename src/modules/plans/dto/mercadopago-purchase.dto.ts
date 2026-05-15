import { Allow, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class MercadoPagoPurchaseDto {
  @IsInt()
  @Min(1)
  payment_id!: number;

  @IsOptional()
  @IsString()
  external_reference?: string;

  @IsOptional()
  @IsString()
  preference_id?: string;

  @IsOptional()
  @IsString()
  merchant_order_id?: string;

  @IsOptional()
  @IsObject()
  @Allow()
  data?: Record<string, unknown>;
}