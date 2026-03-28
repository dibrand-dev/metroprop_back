
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location } from './entities/location.entity';
import { TokkoMigratorModule } from '../cron-tasks/tokko-migrator/tokko-migrator.module';
import { TokkoMigratorService } from '../cron-tasks/tokko-migrator/tokko-migrator.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [TypeOrmModule.forFeature([Location]), 
    TokkoMigratorModule, 
    CacheModule.register({
    ttl: 86400, // tiempo por defecto en segundos (1 día)
  })],
  controllers: [LocationsController],
  providers: [LocationsService, TokkoMigratorService],
  exports: [LocationsService],
})
export class LocationsModule {}
