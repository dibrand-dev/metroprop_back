import { Controller, Post, Body } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { SimpleRegistrationDto } from './dto/simple-registration.dto';
import { ProfessionalRegistrationDto } from './dto/professional-registration.dto';

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
}