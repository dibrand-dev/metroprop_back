
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsNewController } from './locations_new.controller';
import { LocationsNewService } from './locations_new.service';
import { LocationNew } from './entities/locations_new.entity';
import { TokkoMigratorModule } from '../cron-tasks/tokko-migrator/tokko-migrator.module';
import { TokkoMigratorService } from '../cron-tasks/tokko-migrator/tokko-migrator.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [TypeOrmModule.forFeature([LocationNew]), 
    TokkoMigratorModule, 
    CacheModule.register({
    ttl: 86400, // tiempo por defecto en segundos (1 día)
  })],
  controllers: [LocationsNewController],
  providers: [LocationsNewService, TokkoMigratorService],
  exports: [LocationsNewService],
})
export class LocationsNewModule {}
