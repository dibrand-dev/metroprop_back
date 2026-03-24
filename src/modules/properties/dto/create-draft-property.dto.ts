import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional } from 'class-validator';
import { OperationType, PropertyType, PropertySubtype } from '../../../common/enums';

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

}
