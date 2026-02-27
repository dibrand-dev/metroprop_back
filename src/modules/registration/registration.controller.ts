import { Controller, Post, Body } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { SimpleRegistrationDto } from './dto/simple-registration.dto';
import { ProfessionalRegistrationDto } from './dto/professional-registration.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { ResendWelcomeDto } from './dto/resend-welcome.dto';

@Controller('registration')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post()
  async registerSimple(@Body() dto: SimpleRegistrationDto) {
    return this.registrationService.registerSimple(dto);
  }

  @Post('professional')
  async registerProfessional(@Body() dto: ProfessionalRegistrationDto) {
    return this.registrationService.registerProfessional(dto);
  }

  @Post('google')
  async registerOrLoginWithGoogle(@Body() dto: GoogleOAuthDto) {
    return this.registrationService.registerOrLoginWithGoogle(dto);
  }

  @Post('resend-welcome')
  async resendWelcome(@Body() dto: ResendWelcomeDto) {
    return this.registrationService.resendWelcomeEmail(dto.email);
  }
}