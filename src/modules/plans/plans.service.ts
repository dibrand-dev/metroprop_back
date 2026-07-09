import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { BranchPlan } from './entities/branch-plan.entity';
import { UserPlan } from './entities/user-plan.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Property } from '../properties/entities/property.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanPaymentDto } from './dto/mercadopago-purchase.dto';
import { UserRole, PropertyStatus } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { MercadoPagoService } from '../../common/mercadopago/mercadopago.service';
import { MercadoPagoPreapprovalResponse } from '../../common/mercadopago/mercadopago.types';

export interface CancelPurchasedPlanResult {
  message: string;
  purchased_plan_id: number;
  plan_type: 'user' | 'branch';
  properties_reset: number;
  mercadopago_status?: string;
  already_inactive: boolean;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly mercadopagoService: MercadoPagoService,
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
    @InjectRepository(BranchPlan)
    private readonly branchPlanRepo: Repository<BranchPlan>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepo: Repository<UserPlan>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  findAll(filters: any): Promise<Plan[]> {

    filters.deleted = false; 

    return this.repo.find({
      where: filters,
      order: { plan_name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Plan> {
    const plan = await this.repo.findOne({ where: { id, deleted: false } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const existing = await this.repo.findOne({
      where: { plan_name: dto.plan_name, deleted: false },
    });
    if (existing) {
      throw new ConflictException(
        `A plan with plan_name ${dto.plan_name} already exists`,
      );
    }
    const plan = this.repo.create(dto);
    return this.repo.save(plan);
  }

  async update(id: number, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);
    Object.assign(plan, dto);
    return this.repo.save(plan);
  }

  async disable(id: number): Promise<Plan> {
    const plan = await this.findOne(id);
    plan.is_active = false;
    return this.repo.save(plan);
  } 

  async enable(id: number): Promise<Plan> {
    const plan = await this.findOne(id);
    plan.is_active = true;
    return this.repo.save(plan);
  }

  async remove(id: number): Promise<{ message: string }> {
    const plan = await this.findOne(id);
    plan.deleted = true;
    plan.deleted_at = new Date();
    await this.repo.save(plan);
    return { message: 'Plan deleted successfully' };
  }

  // ─── Branch Plan methods ───────────────────────────────────────────────────

  async createBranchPlan(
    dto: PlanPaymentDto,
    user: User,
    branchId: number,
  ): Promise<BranchPlan> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: ['organization'],
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const branchOrgId = branch.organization?.id;
    if (
      user.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      user.organization_id !== branchOrgId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para operar sobre esta branch',
      );
    }

    const plan = await this.resolvePlanForPayment(dto.planId, dto.transaction_amount);

    const externalReference = `metroprop-branch-${branchId}-plan-${dto.planId}-${Date.now()}`;
    this.logger.log(
      `[PLANS-PAYMENT] createBranchPlan MP CALL START | branchId=${branchId} | userId=${user.id} | planId=${dto.planId} | planName=${plan.plan_name} | planPrice=${plan.price} | planCurrency=${plan.currency} | dtoAmount=${dto.transaction_amount} | payerEmail=${dto.payer.email} | token=${this.maskToken(dto.token)} | payment_method_id=${dto.payment_method_id} | issuer_id=${dto.issuer_id ?? 'n/a'} | externalReference=${externalReference}`,
    );

    let mpPreapproval;
    try {
      mpPreapproval = await this.mercadopagoService.createAuthorizedPreapproval({
        reason: plan.plan_name,
        payer_email: dto.payer.email,
        card_token_id: dto.token,
        transaction_amount: plan.price,
        currency_id: plan.currency,
        external_reference: externalReference,
      });
      this.logger.log(
        `[PLANS-PAYMENT] createBranchPlan MP CALL SUCCESS | preapprovalId=${mpPreapproval.id ?? 'n/a'} | status=${mpPreapproval.status ?? 'n/a'}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[PLANS-PAYMENT] createBranchPlan MP CALL FAILED | branchId=${branchId} | planId=${dto.planId} | payerEmail=${dto.payer.email} | error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    const tracking = this.mercadopagoService.extractPreapprovalTrackingFields(mpPreapproval);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const branchPlan = this.branchPlanRepo.create({
      branch_id: branchId,
      plan_id: dto.planId,
      amount_hired: 1,
      plan_price_paid: plan.price,
      plan_name_hired: plan.plan_name,
      mercadopago_response: mpPreapproval,
      mercadopago_payment_id: tracking.paymentId,
      mercadopago_preapproval_id: tracking.preapprovalId,
      mercadopago_external_reference: tracking.externalReference,
      mercadopago_status: tracking.status,
      mercadopago_status_detail: tracking.statusDetail,
      mercadopago_last_status_check_at: now,
      mercadopago_last_status_payload: mpPreapproval,
      start_date: now,
      end_date: endDate,
      active: true,
      organization_id: branchOrgId,
    });

    return this.branchPlanRepo.save(branchPlan);
  }



  async endBranchPlan(branchPlanId: number, user: any): Promise<BranchPlan> {
    const branchPlan = await this.branchPlanRepo.findOne({
      where: { id: branchPlanId },
    });
    if (!branchPlan) throw new NotFoundException('Branch plan not found');

    if (
      user.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      user.organization_id !== branchPlan.organization_id
    ) {
      throw new ForbiddenException(
        'No tienes permisos para operar sobre este plan',
      );
    }

    branchPlan.active = false;
    return this.branchPlanRepo.save(branchPlan);
  }

  async getBranchPlanAvailability(branchId: number, user: any) {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: ['organization'],
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (
      user.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      user.organization_id !== branch.organization?.id
    ) {
      throw new ForbiddenException(
        'No tienes permisos para ver la disponibilidad de esta branch',
      );
    }

    const rows = await this.branchPlanRepo
      .createQueryBuilder('bp')
      .innerJoin('bp.plan', 'p')
      .leftJoin(
        (qb) =>
          qb
        //     .select('prop.hired_plan_id', 'hpid')
            .select('prop.purchased_plan_id', 'ppid')
            .addSelect('COUNT(prop.id)', 'cnt')
            .from(Property, 'prop')
            .where('prop.branch_id = :branchId')
            .andWhere('prop.deleted = false')
            .andWhere('prop.status NOT IN (:...excludedStatuses)')
            .groupBy('prop.purchased_plan_id'),
        'prop_counts',
        'prop_counts.ppid = p.id',
      )
      .select('p.id', 'plan_id')
      .addSelect('p.plan_name', 'plan_name')
      .addSelect('p.highlight_limit', 'highlight_limit')
      .addSelect('p.visibility', 'visibility')
      .addSelect('bp.id', 'purchased_plan_id')
      .addSelect('bp.start_date', 'start_date')
      .addSelect('bp.end_date', 'end_date')
      .addSelect('ARRAY_AGG(bp.id)', 'branch_plan_ids')
      .addSelect('COALESCE(MAX(prop_counts.cnt), 0)', 'used')
      .where('bp.branch_id = :branchId', { branchId })
      .andWhere('bp.active = true')
      .andWhere('bp.end_date >= :now', { now: new Date() })
      .andWhere('p.deleted = false')
      .andWhere('p.is_active = true')
      .groupBy('p.id')
      .addGroupBy('p.plan_name')
      .addGroupBy('p.highlight_limit')
      .addGroupBy('bp.start_date')
      .addGroupBy('bp.end_date')
      .addGroupBy('bp.id')
      .setParameter('excludedStatuses', [PropertyStatus.DRAFT, PropertyStatus.ARCHIVADA])
      .getRawMany<{
        plan_id: number;
        purchased_plan_id: number;
        plan_name: string;
        visibility: string;
        highlight_limit: number;
        start_date: Date;
        end_date: Date;
        branch_plan_ids: number[];
        used: string;
      }>();

    return rows.map((r) => {
      const used = parseInt(r.used, 10);
      return {
        plan_id: r.plan_id,
        purchased_plan_id: r.purchased_plan_id,
        plan_name: r.plan_name,
        plan_visibility: r.visibility,
        highlight_limit: r.highlight_limit,
        branch_plan_ids: r.branch_plan_ids,
        start_date: r.start_date,
        end_date: r.end_date,
        used,
        available: Math.max(0, r.highlight_limit - used),
      };
    });
  }

  async getBranchPlans(branchId: number, user: any): Promise<BranchPlan[]> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: ['organization'],
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const branchOrgId = branch.organization?.id;
    if (
      user.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      user.organization_id !== branchOrgId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para ver los planes de esta branch',
      );
    }

    return this.branchPlanRepo.find({
      where: { branch_id: branchId },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
  }

  // ─── User Plan methods ─────────────────────────────────────────────────────

  async createUserPlan(
    dto: PlanPaymentDto,
    requester: User,
    userId: number,
  ): Promise<UserPlan> {
    const targetUser = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['organization'],
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const orgId = targetUser.organization?.id;
    if (
      requester.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      requester.id !== userId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para operar sobre este usuario',
      );
    }

    const plan = await this.resolvePlanForPayment(dto.planId, dto.transaction_amount);

    const externalReference = `metroprop-user-${userId}-plan-${dto.planId}-${Date.now()}`;
    this.logger.log(
      `[PLANS-PAYMENT] createUserPlan START | targetUserId=${userId} | requesterId=${requester.id} | planId=${dto.planId} | planName=${plan.plan_name} | planPrice=${plan.price} | planCurrency=${plan.currency} | dtoAmount=${dto.transaction_amount} | payerEmail=${dto.payer.email} | token=${this.maskToken(dto.token)} | payment_method_id=${dto.payment_method_id} | issuer_id=${dto.issuer_id ?? 'n/a'} | externalReference=${externalReference}`,
    );
    this.logger.log(
      `[PLANS-PAYMENT] createUserPlan DTO payer: ${JSON.stringify({ email: dto.payer.email, identification: dto.payer.identification, phone: dto.payer.phone })}`,
    );

    let mpPreapproval;
    try {
      this.logger.log('[PLANS-PAYMENT] createUserPlan calling MercadoPago createAuthorizedPreapproval...');
      mpPreapproval = await this.mercadopagoService.createAuthorizedPreapproval({
        reason: plan.plan_name,
        payer_email: dto.payer.email,
        card_token_id: dto.token,
        transaction_amount: plan.price,
        currency_id: plan.currency,
        external_reference: externalReference,
      });
      this.logger.log(
        `[PLANS-PAYMENT] createUserPlan MP SUCCESS | preapprovalId=${mpPreapproval.id ?? 'n/a'} | status=${mpPreapproval.status ?? 'n/a'} | status_detail=${mpPreapproval.status_detail ?? 'n/a'}`,
      );
      this.logger.debug(
        `[PLANS-PAYMENT] createUserPlan MP full response: ${JSON.stringify(mpPreapproval)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[PLANS-PAYMENT] createUserPlan MP FAILED | userId=${userId} | planId=${dto.planId} | payerEmail=${dto.payer.email} | error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    const tracking = this.mercadopagoService.extractPreapprovalTrackingFields(mpPreapproval);
    this.logger.log(
      `[PLANS-PAYMENT] createUserPlan tracking extracted: ${JSON.stringify(tracking)}`,
    );
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const userPlan = this.userPlanRepo.create({
      user_id: userId,
      plan_id: dto.planId,
      amount_hired: 1,
      plan_price_paid: plan.price,
      plan_name_hired: plan.plan_name,
      mercadopago_response: mpPreapproval,
      mercadopago_payment_id: tracking.paymentId,
      mercadopago_preapproval_id: tracking.preapprovalId,
      mercadopago_external_reference: tracking.externalReference,
      mercadopago_status: tracking.status,
      mercadopago_status_detail: tracking.statusDetail,
      mercadopago_last_status_check_at: now,
      mercadopago_last_status_payload: mpPreapproval,
      start_date: now,
      end_date: endDate,
      active: true,
      organization_id: orgId,
    });

    return this.userPlanRepo.save(userPlan);
  }

  async cancelUserPlan(
    purchasedPlanId: number,
    requester: User,
  ): Promise<CancelPurchasedPlanResult> {
    const userPlan = await this.userPlanRepo.findOne({
      where: { id: purchasedPlanId },
    });
    if (!userPlan) {
      throw new NotFoundException('User plan not found');
    }

    if (requester.id !== userPlan.user_id) {
      throw new ForbiddenException(
        'No tenés permiso para dar de baja este plan',
      );
    }

    if (!userPlan.active) {
      return {
        message: 'El plan ya estaba dado de baja',
        purchased_plan_id: userPlan.id,
        plan_type: 'user',
        properties_reset: 0,
        mercadopago_status: userPlan.mercadopago_status,
        already_inactive: true,
      };
    }

    const mpResponse = await this.cancelMercadoPagoSubscription(
      userPlan.mercadopago_preapproval_id,
    );

    const now = new Date();
    return this.userPlanRepo.manager.transaction(async (manager) => {
      const userPlanRepo = manager.getRepository(UserPlan);
      const propertyRepo = manager.getRepository(Property);

      userPlan.active = false;
      userPlan.mercadopago_cancelled_at = now;
      userPlan.mercadopago_last_status_check_at = now;
      if (mpResponse) {
        const tracking = this.mercadopagoService.extractPreapprovalTrackingFields(mpResponse);
        userPlan.mercadopago_status = tracking.status ?? 'cancelled';
        userPlan.mercadopago_status_detail = tracking.statusDetail;
        userPlan.mercadopago_last_status_payload = mpResponse;
      } else {
        userPlan.mercadopago_status = 'cancelled';
      }

      await userPlanRepo.save(userPlan);

      const propertyUpdateResult = await propertyRepo.update(
        { purchased_plan_id: userPlan.id, user_id: userPlan.user_id },
        {
          hired_plan_id: null as unknown as number,
          purchased_plan_id: null as unknown as number,
          visibility: 0,
        },
      );

      this.logger.log(
        `[PLANS-CANCEL] cancelUserPlan OK | purchasedPlanId=${purchasedPlanId} | userId=${userPlan.user_id} | propertiesReset=${propertyUpdateResult.affected ?? 0}`,
      );

      return {
        message: 'Plan dado de baja correctamente',
        purchased_plan_id: userPlan.id,
        plan_type: 'user',
        properties_reset: propertyUpdateResult.affected ?? 0,
        mercadopago_status: userPlan.mercadopago_status,
        already_inactive: false,
      };
    });
  }

  async cancelBranchPlan(
    purchasedPlanId: number,
    requester: User,
  ): Promise<CancelPurchasedPlanResult> {
    const branchPlan = await this.branchPlanRepo.findOne({
      where: { id: purchasedPlanId },
    });
    if (!branchPlan) {
      throw new NotFoundException('Branch plan not found');
    }

    const isSuperAdmin = requester.role_id === UserRole.USER_ROL_SUPER_ADMIN;
    const isOrgAdmin = requester.role_id === UserRole.USER_ROL_ADMIN;
    if (
      !isSuperAdmin &&
      (!isOrgAdmin || requester.organization_id !== branchPlan.organization_id)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para dar de baja este plan',
      );
    }

    if (!branchPlan.active) {
      return {
        message: 'El plan ya estaba dado de baja',
        purchased_plan_id: branchPlan.id,
        plan_type: 'branch',
        properties_reset: 0,
        mercadopago_status: branchPlan.mercadopago_status,
        already_inactive: true,
      };
    }

    const mpResponse = await this.cancelMercadoPagoSubscription(
      branchPlan.mercadopago_preapproval_id,
    );

    const now = new Date();
    return this.branchPlanRepo.manager.transaction(async (manager) => {
      const branchPlanRepo = manager.getRepository(BranchPlan);
      const propertyRepo = manager.getRepository(Property);

      branchPlan.active = false;
      branchPlan.mercadopago_cancelled_at = now;
      branchPlan.mercadopago_last_status_check_at = now;
      if (mpResponse) {
        const tracking = this.mercadopagoService.extractPreapprovalTrackingFields(mpResponse);
        branchPlan.mercadopago_status = tracking.status ?? 'cancelled';
        branchPlan.mercadopago_status_detail = tracking.statusDetail;
        branchPlan.mercadopago_last_status_payload = mpResponse;
      } else {
        branchPlan.mercadopago_status = 'cancelled';
      }

      await branchPlanRepo.save(branchPlan);

      const propertyUpdateResult = await propertyRepo.update(
        { purchased_plan_id: branchPlan.id, branch_id: branchPlan.branch_id },
        {
          hired_plan_id: null as unknown as number,
          purchased_plan_id: null as unknown as number,
          visibility: 0,
        },
      );

      this.logger.log(
        `[PLANS-CANCEL] cancelBranchPlan OK | purchasedPlanId=${purchasedPlanId} | branchId=${branchPlan.branch_id} | propertiesReset=${propertyUpdateResult.affected ?? 0}`,
      );

      return {
        message: 'Plan dado de baja correctamente',
        purchased_plan_id: branchPlan.id,
        plan_type: 'branch',
        properties_reset: propertyUpdateResult.affected ?? 0,
        mercadopago_status: branchPlan.mercadopago_status,
        already_inactive: false,
      };
    });
  }

  async getUserPlanAvailability(userId: number, requester: any) {
    const targetUser = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['organization'],
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const rows = await this.userPlanRepo
      .createQueryBuilder('up')
      .innerJoin('up.plan', 'p')
      .leftJoin(
        (qb) =>
          qb
       //     .select('prop.hired_plan_id', 'hpid')
            .select('prop.purchased_plan_id', 'ppid')  
            .addSelect('COUNT(prop.id)', 'cnt')
            .from(Property, 'prop')
            .where('prop.user_id = :userId')
            .andWhere('prop.deleted = false')
            .andWhere('prop.status NOT IN (:...excludedStatuses)')
            .groupBy('prop.purchased_plan_id'),
        'prop_counts',
        'prop_counts.ppid = p.id',
      )
      .select('p.id', 'plan_id')
      .addSelect('p.plan_name', 'plan_name')
      .addSelect('p.highlight_limit', 'highlight_limit')
      .addSelect('p.visibility', 'visibility')
      .addSelect('ARRAY_AGG(up.id)', 'user_plan_ids')
      .addSelect('COALESCE(MAX(prop_counts.cnt), 0)', 'used')
      .addSelect('up.id', 'purchased_plan_id')
      .addSelect('up.start_date', 'start_date')
      .addSelect('up.end_date', 'end_date') 
      .where('up.user_id = :userId', { userId })
      .andWhere('up.active = true')
      .andWhere('up.end_date >= :now', { now: new Date() })
      .andWhere('p.deleted = false')
      .andWhere('p.is_active = true')
      .groupBy('p.id')
      .addGroupBy('p.plan_name')
      .addGroupBy('p.highlight_limit')
      .addGroupBy('up.id')
      .addGroupBy('up.start_date')
      .addGroupBy('up.end_date')
      .setParameter('excludedStatuses', [PropertyStatus.DRAFT, PropertyStatus.ARCHIVADA])
      .getRawMany<{
        plan_id: number;
        plan_name: string;
        highlight_limit: number;
        visibility: string;
        user_plan_ids: number[];
        start_date: Date;
        end_date: Date;
        used: string;
        purchased_plan_id: number;
      }>();

    return rows.map((r) => {
      const used = parseInt(r.used, 10);
      return {
        plan_id: r.plan_id,
        purchased_plan_id: r.purchased_plan_id,
        plan_name: r.plan_name,
        plan_visibility: r.visibility,
        highlight_limit: r.highlight_limit,
        start_date: r.start_date,
        end_date: r.end_date,
        user_plan_ids: r.user_plan_ids,
        used,
        available: Math.max(0, r.highlight_limit - used),
      };
    });
  }

  async getUserPlans(userId: number, requester: any): Promise<UserPlan[]> {
    const targetUser = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['organization'],
    });
    if (!targetUser) throw new NotFoundException('User not found');

    if (
      requester.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      requester.id !== userId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para ver los planes de este usuario',
      );
    }

    return this.userPlanRepo.find({
      where: { user_id: userId },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
  }

  private async cancelMercadoPagoSubscription(
    preapprovalId?: string,
  ): Promise<MercadoPagoPreapprovalResponse | null> {
    if (!preapprovalId) {
      this.logger.warn(
        '[PLANS-CANCEL] cancelMercadoPagoSubscription skipped | missing preapprovalId',
      );
      return null;
    }

    return this.mercadopagoService.cancelPreapproval(preapprovalId);
  }

  private async resolvePlanForPayment(
    planId: number,
    transactionAmount: number,
  ): Promise<Plan> {
    this.logger.log(
      `[PLANS-PAYMENT] resolvePlanForPayment START | planId=${planId} | transactionAmount=${transactionAmount}`,
    );

    const plan = await this.repo.findOne({
      where: { id: planId, deleted: false },
    });
    if (!plan) {
      this.logger.warn(`[PLANS-PAYMENT] resolvePlanForPayment NOT FOUND | planId=${planId}`);
      throw new NotFoundException('Plan not found');
    }

    this.logger.log(
      `[PLANS-PAYMENT] resolvePlanForPayment plan loaded | id=${plan.id} | name=${plan.plan_name} | price=${plan.price} | currency=${plan.currency} | is_active=${plan.is_active}`,
    );

    if (!plan.is_active) {
      this.logger.warn(
        `[PLANS-PAYMENT] resolvePlanForPayment INACTIVE | planId=${planId} | name=${plan.plan_name}`,
      );
      throw new BadRequestException(
        `El plan "${plan.plan_name}" no está disponible para contratar en este momento.`,
      );
    }

    if (plan.price !== transactionAmount) {
      this.logger.warn(
        `[PLANS-PAYMENT] resolvePlanForPayment PRICE MISMATCH | planId=${planId} | expected=${plan.price} ${plan.currency} | received=${transactionAmount}`,
      );
      throw new BadRequestException(
        `El monto enviado (${transactionAmount} ${plan.currency}) no coincide con el precio actual del plan "${plan.plan_name}" (${plan.price} ${plan.currency}). Actualizá la página e intentá nuevamente.`,
      );
    }

    this.logger.log('[PLANS-PAYMENT] resolvePlanForPayment OK');
    return plan;
  }

  private maskToken(token?: string): string {
    if (!token) return '(empty)';
    const trimmed = token.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)} (len=${trimmed.length})`;
  }

}
