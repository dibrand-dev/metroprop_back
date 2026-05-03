import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchAlert } from './entities/search-alert.entity';
import { SearchAlertsService } from './search-alerts.service';
import { SearchAlertsController } from './search-alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SearchAlert])],
  providers: [SearchAlertsService],
  controllers: [SearchAlertsController],
  exports: [SearchAlertsService],
})
export class SearchAlertsModule {}
