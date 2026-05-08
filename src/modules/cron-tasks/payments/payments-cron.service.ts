import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BranchPlan } from '../../plans/entities/branch-plan.entity';
import { Property } from '../../properties/entities/property.entity';
import { PublicationPlan } from '../../../common/enums';

@Injectable()
export class PaymentsCronService {
  private readonly logger = new Logger(PaymentsCronService.name);

  constructor(
    @InjectRepository(BranchPlan)
    private readonly branchPlanRepo: Repository<BranchPlan>,
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

    if (!expiredBranchPlans.length) {
      this.logger.log('[PaymentsCron] No hay branch_plans vencidos activos para procesar.');
      return;
    }

    const expiredIds = expiredBranchPlans.map((bp) => bp.id);

    const branchPlanUpdateResult = await this.branchPlanRepo
      .createQueryBuilder()
      .update(BranchPlan)
      .set({ active: false })
      .where('id IN (:...ids)', { ids: expiredIds })
      .andWhere('active = true')
      .execute();

    const propertyUpdateResult = await this.propertyRepo.update(
      { hired_plan_id: In(expiredIds) },
      {
        hired_plan_id: null as unknown as number,
        selected_plan: PublicationPlan.PUBLICATION_FREE,
      },
    );

    this.logger.log(
      `[PaymentsCron] Branch plans expirados desactivados: ${branchPlanUpdateResult.affected ?? 0}. Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
    );
  }
}
