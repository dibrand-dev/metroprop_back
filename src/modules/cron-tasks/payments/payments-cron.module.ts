import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsCronService } from './payments-cron.service';
import { BranchPlan } from '../../plans/entities/branch-plan.entity';
import { UserPlan } from '../../plans/entities/user-plan.entity';
import { Property } from '../../properties/entities/property.entity';
import { MercadoPagoModule } from '../../../common/mercadopago/mercadopago.module';
import { EmailModule } from '../../../common/email/email.module';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { PlansModule } from '../../plans/plans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BranchPlan, UserPlan, Property, Branch, User]),
    MercadoPagoModule,
    EmailModule,
    PlansModule,
  ],
  providers: [PaymentsCronService],
})
export class PaymentsCronModule {}
