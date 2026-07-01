import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './entities/lead.entity';
import { Property } from '../properties/entities/property.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Partner } from '../partners/entities/partner.entity';
import { User } from '../users/entities/user.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { EmailModule } from '../../common/email/email.module';
import { PropertiesModule } from '../properties/properties.module';
import { TokkoSyncLoggerService } from '../cron-tasks/tokko-sync/tokko-sync-logger.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Property, Organization, Partner, User]),
    EmailModule,
    PropertiesModule,
  ],
  providers: [LeadsService, TokkoSyncLoggerService],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}