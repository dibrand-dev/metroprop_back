
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location } from './entities/location.entity';
import { TokkoMigratorModule } from '../cron-tasks/tokko-migrator/tokko-migrator.module';
import { TokkoMigratorService } from '../cron-tasks/tokko-migrator/tokko-migrator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Location]), TokkoMigratorModule],
  controllers: [LocationsController],
  providers: [LocationsService, TokkoMigratorService],
  exports: [LocationsService],
})
export class LocationsModule {}
