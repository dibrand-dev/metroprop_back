import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsInt, Min } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  name!: string; 

  @IsNotEmpty()
  company_name!: string; 
  
  @IsNotEmpty()
  phone!: string; 

  @IsOptional()
  @IsInt()
  @Min(1)
  organizationId?: number;
}