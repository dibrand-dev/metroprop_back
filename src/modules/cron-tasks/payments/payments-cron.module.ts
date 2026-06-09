import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsCronService } from './payments-cron.service';
import { BranchPlan } from '../../plans/entities/branch-plan.entity';
import { UserPlan } from '../../plans/entities/user-plan.entity';
import { Property } from '../../properties/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BranchPlan, UserPlan, Property])],
  providers: [PaymentsCronService],
})
export class PaymentsCronModule {}
