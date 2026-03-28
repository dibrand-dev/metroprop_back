import { Module } from '@nestjs/common';
import { TokkoMigratorService } from './tokko-migrator.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  providers: [TokkoMigratorService],
  exports: [TokkoMigratorService],
})
export class TokkoMigratorModule {}
