import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BranchPlan } from '../../plans/entities/branch-plan.entity';
import { Property } from '../../properties/entities/property.entity';
import { UserPlan } from '../../plans/entities/user-plan.entity';

@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name);

  constructor(
    @InjectRepository(BranchPlan)
    private readonly branchPlanRepo: Repository<BranchPlan>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepo: Repository<UserPlan>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  // Corre todos los dias a las 00:30
  @Cron('30 0 * * *')
  async handlePaymentsExpiration(): Promise<void> {
    const now = new Date();

    const expiredBranchPlans = await this.branchPlanRepo.find({
      where: {
        active: true,
        end_date: LessThan(now),
      },
      select: ['id'],
    });

    if (expiredBranchPlans.length > 0) {
      const expiredIds = expiredBranchPlans.map((bp) => bp.id);

      const branchPlanUpdateResult = await this.branchPlanRepo
        .createQueryBuilder()
        .update(BranchPlan)
        .set({ active: false })
        .where('id IN (:...ids)', { ids: expiredIds })
        .andWhere('active = true')
        .execute();

      const propertyUpdateResult = await this.propertyRepo.update(
        { purchased_plan_id: In(expiredIds) },
        {
          hired_plan_id: null as unknown as number,
          purchased_plan_id: null as unknown as number,
          visibility: 0, 
        },
      );

      this.logger.log(
        `[PaymentsCron] Branch plans expirados desactivados: ${branchPlanUpdateResult.affected ?? 0}. Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
      );
    }
 

    const expiredUserPlans = await this.userPlanRepo.find({
      where: {
        active: true,
        end_date: LessThan(now),
      },
      select: ['id'],
    }); 

     if (expiredUserPlans.length > 0) {
      const expiredUserIds = expiredUserPlans.map((up) => up.id);

      const userPlanUpdateResult = await this.userPlanRepo
        .createQueryBuilder()
        .update(UserPlan)
        .set({ active: false })
        .where('id IN (:...ids)', { ids: expiredUserIds })
        .andWhere('active = true')
        .execute();

      const propertyUpdateResult = await this.propertyRepo.update(
        { purchased_plan_id: In(expiredUserIds) },
        {
          hired_plan_id: null as unknown as number,
          purchased_plan_id: null as unknown as number,
          visibility: 0, 
        },
      );

      this.logger.log(
        `[PaymentsCron] User plans expirados desactivados: ${userPlanUpdateResult.affected ?? 0}. Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
      );
    }
  
  }
}
