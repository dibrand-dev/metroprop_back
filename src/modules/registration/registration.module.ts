import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { EmailModule } from '../../common/email/email.module';
import { OrganizationsService } from '../organizations/organizations.service';
import { BranchesService } from '../branches/branches.service';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';

import { S3Service } from '../../common/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, Branch]),
    UsersModule,
    ImageUploadModule,
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseInt(configService.get<string>('JWT_EXPIRATION') || '3600'),
        },
      }),
    }),
  ],
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    UsersService,
    OrganizationsService,
    BranchesService,
    S3Service,
  ],
  exports: [RegistrationService],
})
export class RegistrationModule {}