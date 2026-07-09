import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PayerIdentificationDto {
  @IsString()
  type!: string;

  @IsString()
  number!: string;
}

export class PayerPhoneDto {
  @IsString()
  area_code!: string;

  @IsString()
  number!: string;
}

export class PayerDto {
  @IsString()
  email!: string;

  @ValidateNested()
  @Type(() => PayerIdentificationDto)
  identification!: PayerIdentificationDto;

  @ValidateNested()
  @Type(() => PayerPhoneDto)
  phone!: PayerPhoneDto;
}

export class PlanPaymentDto {
  @IsNumber()
  transaction_amount!: number;

  @IsString()
  token!: string;

  @IsString()
  description!: string;

  @IsInt()
  installments!: number;

  @IsString()
  payment_method_id!: string;

  @IsOptional()
  @IsInt()
  issuer_id?: number;

  @ValidateNested()
  @Type(() => PayerDto)
  payer!: PayerDto;

  @IsInt()
  planId!: number;
}
