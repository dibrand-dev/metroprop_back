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
import { PropertyOperation } from '../properties/entities/property-operation.entity';
import { PropertyTag } from '../properties/entities/property-tag.entity';
import { PropertyVideo } from '../properties/entities/property-video.entity';
import { PropertyAttached } from '../properties/entities/property-attached.entity';
import { PropertiesModule } from '../properties/properties.module';
import { EmailModule } from '../../common/email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Partner,
      Organization,
      Branch,
      User,
      Property,
      PropertyImage,
      PropertyOperation,
      PropertyTag,
      PropertyVideo,
      PropertyAttached,
    ]),
    ImageUploadModule,
    PropertiesModule,
    EmailModule,
    UsersModule,
  ],
  providers: [PartnersService, PartnerApiService, ApiKeyAuthGuard],
  controllers: [PartnersController, PartnerApiController],
  exports: [PartnersService],
})
export class PartnersModule {}
