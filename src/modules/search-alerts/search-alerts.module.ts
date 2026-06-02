import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchAlert } from './entities/search-alert.entity';
import { SearchAlertsService } from './search-alerts.service';
import { SearchAlertsController } from './search-alerts.controller';
import { SearchAlertsCronModule } from '../cron-tasks/search-alerts/search-alerts-cron.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchAlert]),
    SearchAlertsCronModule,
  ],
  providers: [SearchAlertsService],
  controllers: [SearchAlertsController],
  exports: [SearchAlertsService],
})
export class SearchAlertsModule {}
