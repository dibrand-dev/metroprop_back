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
}
