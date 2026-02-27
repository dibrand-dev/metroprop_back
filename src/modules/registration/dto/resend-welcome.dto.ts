import { IsEmail } from 'class-validator';

export class ResendWelcomeDto {
  @IsEmail()
  email!: string;
}
