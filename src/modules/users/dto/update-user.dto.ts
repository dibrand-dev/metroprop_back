import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {
	@IsOptional()
	@IsArray()
	@Type(() => Number)
	branchIds?: number[];

  @IsOptional()
  @IsString()
  google_id?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phone_additional?: string ;

  @IsOptional()
  @IsString()
  name?: string;


  @IsOptional()
  @IsString()
  email?: string;

}
