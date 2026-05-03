import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchAlert } from '../../search-alerts/entities/search-alert.entity';
import { User } from '../../users/entities/user.entity';
import { SearchAlertsCronService } from './search-alerts-cron.service';
import { EmailModule } from '../../../common/email/email.module';
import { PropertiesModule } from '../../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchAlert, User]),
    EmailModule,
    PropertiesModule,
  ],
  providers: [SearchAlertsCronService],
})
export class SearchAlertsCronModule {}
