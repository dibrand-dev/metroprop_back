import { ImageUploadModule } from '../../common/image-upload/image-upload.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from './entities/partner.entity';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PartnerApiController } from './partner-api.controller';
import { PartnerApiService } from './partner-api.service';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';

import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { PropertyAttached } from '../properties/entities/property-attached.entity';
import { PropertiesModule } from '../properties/properties.module';
import { EmailModule } from '../../common/email/email.module';
import { UsersModule } from '../users/users.module';
import { BranchesModule } from '../branches/branches.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { LocationsModule } from '../locations/locations.module';
import { TagsModule } from '../tags/tags.module';
import { TokkoHelperService } from '../../common/helpers/tokko-helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Partner,
      Organization,
      Branch,
      User,
      Property,
      PropertyImage,
      PropertyAttached,
    ]),
    ImageUploadModule,
    PropertiesModule,
    EmailModule,
    UsersModule,
    BranchesModule,
    OrganizationsModule,
    LocationsModule,
    TagsModule,
  ],
  providers: [PartnersService, PartnerApiService, ApiKeyAuthGuard, TokkoHelperService],
  controllers: [PartnersController, PartnerApiController],
  exports: [PartnersService],
})
export class PartnersModule {}
