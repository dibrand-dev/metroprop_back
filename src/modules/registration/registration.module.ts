import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { BranchesService } from '../branches/branches.service';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, Branch]),
  ],
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    UsersService,
    OrganizationsService,
    BranchesService,
  ],
  exports: [RegistrationService],
})
export class RegistrationModule {}