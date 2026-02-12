import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class GoogleOAuthDto {
  @IsNotEmpty()
  @IsString()
  google_id!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
