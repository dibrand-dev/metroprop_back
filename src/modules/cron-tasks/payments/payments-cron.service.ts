import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { BranchPlan } from '../../plans/entities/branch-plan.entity';
import { Property } from '../../properties/entities/property.entity';
import { UserPlan } from '../../plans/entities/user-plan.entity';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { MercadoPagoService } from '../../../common/mercadopago/mercadopago.service';
import { MercadoPagoStatusSnapshot } from '../../../common/mercadopago/mercadopago.types';
import { TOKKO_PARTNER_NAME } from '../../../common/constants';
import { EmailService } from '../../../common/email/email.service';
import { Branch } from '../../branches/entities/branch.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PaymentsCronService {
     

  constructor(
    private readonly mercadopagoService: MercadoPagoService,
    private readonly emailService: EmailService,
    @InjectRepository(BranchPlan)
    private readonly branchPlanRepo: Repository<BranchPlan>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepo: Repository<UserPlan>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mylogger: AppLoggerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePaymentsExpirationDaily(): Promise<void> {
    const now = new Date();

    const activeBranchPlans = await this.branchPlanRepo.find({
      where: [{ active: true }, { mercadopago_status: 'paused' }],
      select: [
        'id',
        'active',
        'branch_id',
        'plan_id',
        'organization_id',
        'plan_name_hired',
        'mercadopago_payment_id',
        'mercadopago_preapproval_id',
        'mercadopago_status',
        'mercadopago_status_detail',
        'mercadopago_external_reference',
        'mercadopago_response',
        'status_payment',
      ],
    });

    if (activeBranchPlans.length > 0) {
      for (const branchPlan of activeBranchPlans) {
        await this.syncBranchPlanStatus(branchPlan, now);
      }
    } else {
      this.mylogger.log(
        `payments_cron_${now.toISOString()} `,
        '[PaymentsCron] No active/paused branch plans found.',
      );
    }

    const activeUserPlans = await this.userPlanRepo.find({
      where: [{ active: true }, { mercadopago_status: 'paused' }],
      select: [
        'id',
        'active',
        'user_id',
        'plan_id',
        'organization_id',
        'plan_name_hired',
        'mercadopago_payment_id',
        'mercadopago_preapproval_id',
        'mercadopago_status',
        'mercadopago_status_detail',
        'mercadopago_external_reference',
        'mercadopago_response',
        'status_payment',
      ],
    });

    if (activeUserPlans.length > 0) {
      for (const userPlan of activeUserPlans) {
        await this.syncUserPlanStatus(userPlan, now);
      }
    } else {
      this.mylogger.log(
        `payments_cron_${now.toISOString()} `,
        '[PaymentsCron] No active/paused user plans found.',
      );
    }
  }

  @Cron(CronExpression.EVERY_YEAR)
  async handlePaymentsExpiration(): Promise<void> {
    // METODO DE EXPIRACION POR FECHA DE VENCIMIENTO (ACTUALMENTE NO APLICA ESTE TIPO DE EXPIRACION)
    return;

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

      this.mylogger.log(
        `payments_cron_${now.toISOString()} `,
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

      this.mylogger.log(
        `payments_cron_${now.toISOString()} `,
        `[PaymentsCron] User plans expirados desactivados: ${userPlanUpdateResult.affected ?? 0}. Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
      );
    }
  }

  private async syncBranchPlanStatus(
    branchPlan: BranchPlan,
    now: Date,
  ): Promise<void> {
    try {
      const snapshot = await this.mercadopagoService.fetchStatusForPlan(
        branchPlan.mercadopago_preapproval_id,
        branchPlan.mercadopago_payment_id,
      );

      if (!snapshot) {
        await this.handleSpecialPaymentStatus({
          now,
          planType: 'branch',
          message: 'identificador MP faltante',
          branchPlan,
          notify: true,
        });
        return;
      }

      const nextState = this.applyMercadoPagoSnapshot(branchPlan, snapshot, now);
      nextState.status_payment = undefined;
      await this.branchPlanRepo.save(nextState);

      if (
        this.shouldDeactivateBySource(snapshot.source, snapshot.status) &&
        nextState.active
      ) {
        nextState.active = false;
        nextState.mercadopago_cancelled_at = now;
        await this.branchPlanRepo.save(nextState);

        const propertyUpdateResult = await this.propertyRepo.update(
          { purchased_plan_id: branchPlan.id, branch_id: branchPlan.branch_id },
          {
            hired_plan_id: null as unknown as number,
            purchased_plan_id: null as unknown as number,
            visibility: 0,
          },
        );

        this.mylogger.log(
          `payments_cron_${now.toISOString()} `,
          `[PaymentsCron] BranchPlan ${branchPlan.id} desactivado por estado MP=${snapshot.status ?? 'n/a'} (${snapshot.source}). Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido al sincronizar estado';

      await this.handleSpecialPaymentStatus({
        now,
        planType: 'branch',
        message: `error al consultar MercadoPago: ${message}`,
        branchPlan,
        notify: true,
      });

      this.mylogger.error(
        `payments_cron_${now.toISOString()} `,
        `[PaymentsCron] Error sincronizando BranchPlan ${branchPlan.id}: ${message}`,
      );
    }
  }

  private async syncUserPlanStatus(userPlan: UserPlan, now: Date): Promise<void> {
    try {
      this.mylogger.log(
        `payments_cron_${now.toISOString()} `,
        `[PaymentsCron] Analizando UserPlan ${userPlan.id} para user ${userPlan.user_id}...`,
      );

      const snapshot = await this.mercadopagoService.fetchStatusForPlan(
        userPlan.mercadopago_preapproval_id,
        userPlan.mercadopago_payment_id,
      );

      if (!snapshot) {
        await this.handleSpecialPaymentStatus({
          now,
          planType: 'user',
          message: 'identificador MP faltante',
          userPlan,
          notify: true,
        });
        return;
      }

      const nextState = this.applyMercadoPagoSnapshot(userPlan, snapshot, now);
      nextState.status_payment = undefined;
      await this.userPlanRepo.save(nextState);

      if (
        this.shouldDeactivateBySource(snapshot.source, snapshot.status) &&
        nextState.active
      ) {
        nextState.active = false;
        nextState.mercadopago_cancelled_at = now;
        await this.userPlanRepo.save(nextState);

        const propertyUpdateResult = await this.propertyRepo.update(
          { purchased_plan_id: userPlan.id, user_id: userPlan.user_id },
          {
            hired_plan_id: null as unknown as number,
            purchased_plan_id: null as unknown as number,
            visibility: 0,
          },
        );

        this.mylogger.log(
          `payments_cron_${now.toISOString()} `,
          `[PaymentsCron] UserPlan ${userPlan.id} desactivado por estado MP=${snapshot.status ?? 'n/a'} (${snapshot.source}). Properties reseteadas: ${propertyUpdateResult.affected ?? 0}.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido al sincronizar estado';

      await this.handleSpecialPaymentStatus({
        now,
        planType: 'user',
        message: `error al consultar MercadoPago: ${message}`,
        userPlan,
        notify: true,
      });

      this.mylogger.error(
        `payments_cron_${now.toISOString()} `,
        `[PaymentsCron] Error sincronizando UserPlan ${userPlan.id}: ${message}`,
      );
    }
  }

  private async handleSpecialPaymentStatus(params: {
    now: Date;
    planType: 'branch' | 'user';
    message: string;
    branchPlan?: BranchPlan;
    userPlan?: UserPlan;
    notify: boolean;
  }): Promise<void> {
    const { now, planType, message, branchPlan, userPlan, notify } = params;

    if (planType === 'branch' && branchPlan) {
      const notifyThisRun = branchPlan.status_payment !== message;
      branchPlan.status_payment = message;
      await this.branchPlanRepo.save(branchPlan);

      if (notify && notifyThisRun) {
        await this.sendPaymentErrorNotification({
          now,
          planType,
          message,
          branchPlan,
        });
      }
      return;
    }

    if (planType === 'user' && userPlan) {
      const notifyThisRun = userPlan.status_payment !== message;
      userPlan.status_payment = message;
      await this.userPlanRepo.save(userPlan);

      if (notify && notifyThisRun) {
        await this.sendPaymentErrorNotification({
          now,
          planType,
          message,
          userPlan,
        });
      }
    }
  }

  private async sendPaymentErrorNotification(params: {
    now: Date;
    planType: 'branch' | 'user';
    message: string;
    branchPlan?: BranchPlan;
    userPlan?: UserPlan;
  }): Promise<void> {
    const { now, planType, message, branchPlan, userPlan } = params;

    let principalInfo: Record<string, unknown> = {};

    if (planType === 'branch' && branchPlan) {
      const branch = await this.branchRepo.findOne({
        where: { id: branchPlan.branch_id },
        relations: ['organization'],
      });

      principalInfo = {
        branch_id: branchPlan.branch_id,
        branch_name: branch?.branch_name,
        branch_email: branch?.email,
        organization_id: branch?.organization?.id ?? branchPlan.organization_id,
        organization_name: branch?.organization?.company_name,
        organization_email: branch?.organization?.email,
      };
    }

    if (planType === 'user' && userPlan) {
      const user = await this.userRepo.findOne({
        where: { id: userPlan.user_id },
        relations: ['organization'],
      });

      principalInfo = {
        user_id: userPlan.user_id,
        user_name: user?.name,
        user_email: user?.email,
        organization_id: user?.organization?.id ?? userPlan.organization_id,
        organization_name: user?.organization?.company_name,
        organization_email: user?.organization?.email,
      };
    }

    const planRecord = branchPlan ?? userPlan;
    const recordData = {
      plan_type: planType,
      record_id: planRecord?.id,
      plan_id: planRecord?.plan_id,
      plan_name_hired: planRecord?.plan_name_hired,
      active: planRecord?.active,
      status_payment: planRecord?.status_payment,
      mercadopago_preapproval_id: planRecord?.mercadopago_preapproval_id,
      mercadopago_payment_id: planRecord?.mercadopago_payment_id,
      mercadopago_status: planRecord?.mercadopago_status,
      mercadopago_status_detail: planRecord?.mercadopago_status_detail,
      mercadopago_external_reference: planRecord?.mercadopago_external_reference,
    };

    try {
      await this.emailService.sendPaymentErrorNotification({
        occurredAt: now,
        sourceSystem: TOKKO_PARTNER_NAME,
        message,
        recordData,
        principalInfo,
        mercadopagoContractedData: planRecord?.mercadopago_response ?? null,
        mercadopagoLastStatusPayload:
          planRecord?.mercadopago_last_status_payload ?? null,
      });
    } catch (notificationError) {
      this.mylogger.error(
        `payments_cron_${now.toISOString()} `,
        `[PaymentsCron] Error enviando alerta de pago: ${String(notificationError)}`,
      );
    }
  }

  private applyMercadoPagoSnapshot<T extends BranchPlan | UserPlan>(
    plan: T,
    snapshot: MercadoPagoStatusSnapshot,
    now: Date,
  ): T {
    plan.mercadopago_status = this.toOptionalString(snapshot.status);
    plan.mercadopago_status_detail = this.toOptionalString(snapshot.statusDetail);
    plan.mercadopago_external_reference = this.toOptionalString(
      snapshot.externalReference,
    );
    plan.mercadopago_last_status_check_at = now;
    plan.mercadopago_last_status_payload = snapshot.payload;
    return plan;
  }

  private shouldDeactivateBySource(
    source: MercadoPagoStatusSnapshot['source'],
    status?: string,
  ): boolean {
    if (!status) {
      return false;
    }

    const normalized = status.toLowerCase();
    if (source === 'preapproval') {
      return (
        normalized === 'cancelled' ||
        normalized === 'canceled' ||
        normalized === 'paused'
      );
    }

    return [
      'cancelled',
      'canceled',
      'refunded',
      'charged_back',
      'rejected',
      'paused',
    ].includes(normalized);
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
