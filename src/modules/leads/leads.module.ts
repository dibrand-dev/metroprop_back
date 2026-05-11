import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './entities/lead.entity';
import { LeadProperty } from './entities/lead-property.entity';
import { Property } from '../properties/entities/property.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Partner } from '../partners/entities/partner.entity';
import { User } from '../users/entities/user.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, LeadProperty, Property, Organization, Partner, User]),
    EmailModule,
  ],
  providers: [LeadsService],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}