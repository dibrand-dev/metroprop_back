import { IsBoolean, IsEnum, IsInt, isNotEmpty, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OperationType, PropertyType, PropertySubtype, PropertyStatus, Currency } from '../../../common/enums';

export class CreateDraftPropertyDto {
  @IsNotEmpty()
  @IsEnum(OperationType)
  operation_type!: OperationType;

  @IsNotEmpty()
  @IsEnum(PropertyType)
  property_type!: PropertyType;

  @IsOptional()
  @IsEnum(PropertySubtype)
  property_subtype?: PropertySubtype;

  @IsOptional()
  @IsBoolean()
  direct_owner?: boolean;

  @IsOptional()
  @IsInt()
  organization_id?: number; 

  @IsOptional()
  @IsInt()
  branch_id?: number;
  
  @IsOptional()
  @IsInt()
  user_id?: number; 

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus.DRAFT;

  @IsNotEmpty()
  @IsString()
  reference_code: string = Math.random().toString(36).substring(2, 8).toUpperCase(); 

  @IsNotEmpty()
  @IsString()
  publication_title: string = 'draft titulo';

  @IsInt()
  @IsNotEmpty()
  price: number = 0;

  @IsEnum(Currency)
  @IsNotEmpty()
  currency: Currency = Currency.USD;
}
