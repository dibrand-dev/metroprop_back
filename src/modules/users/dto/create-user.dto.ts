import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsInt, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  bio?: string;
  
  @IsOptional()
  @IsInt()
  @Min(1)
  organizationId?: number; 

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  branchIds?: number[];
}

