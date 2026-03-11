import { Module } from '@nestjs/common';
import { DevelopersController } from './developers.controller';

@Module({
  controllers: [DevelopersController],
})
export class DevelopersModule {}
