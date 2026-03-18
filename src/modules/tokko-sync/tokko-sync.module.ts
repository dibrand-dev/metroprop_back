import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokkoSyncState } from './entities/tokko-sync-state.entity';
import { TokkoSyncService } from './tokko-sync.service';
import { TokkoSyncController } from './tokko-sync.controller';

import { Property } from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';

import { PropertiesModule } from '../properties/properties.module';
import { BranchesModule } from '../branches/branches.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { TagsModule } from '../tags/tags.module';
import { LocationsModule } from '../locations/locations.module';
import { TokkoHelperService } from '../../common/helpers/tokko-helper';
import { TokkoSyncLoggerService } from './tokko-sync-logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokkoSyncState, Property, PropertyImage, Organization, Branch]),
    PropertiesModule,
    BranchesModule,
    OrganizationsModule,
    UsersModule,
    TagsModule,
    LocationsModule,
  ],
  providers: [TokkoSyncService, TokkoHelperService, TokkoSyncLoggerService],
  controllers: [TokkoSyncController],
  exports: [TokkoSyncService],
})
export class TokkoSyncModule {}
