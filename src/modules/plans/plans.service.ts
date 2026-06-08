import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

interface MercadoPagoErrorCause {
  code: number | string;
  description?: string;
}

interface MercadoPagoErrorResponse {
  message?: string;
  error?: string;
  status?: number;
  cause?: MercadoPagoErrorCause[];
}

interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payer?: {
    email?: string;
  };
  [key: string]: unknown;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly configService: ConfigService,
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

  findAll(): Promise<Plan[]> {
    return this.repo.find({
      where: { deleted: false },
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

    const plan = await this.repo.findOne({
      where: { id: dto.planId, deleted: false },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const mpPayment = await this.validateMercadoPagoPayment(dto);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const branchPlan = this.branchPlanRepo.create({
      branch_id: branchId,
      plan_id: dto.planId,
      amount_hired: 1,
      plan_price_paid: plan.price,
      plan_name_hired: plan.plan_name,
      mercadopago_response: mpPayment,
      start_date: now,
      end_date: endDate,
      active: true,
      organization_id: branchOrgId,
    });

    console.log("Creating BranchPlan with data:", branchPlan);

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
            .select('prop.hired_plan_id', 'hpid')
            .addSelect('COUNT(prop.id)', 'cnt')
            .from(Property, 'prop')
            .where('prop.branch_id = :branchId')
            .andWhere('prop.deleted = false')
            .andWhere('prop.status NOT IN (:...excludedStatuses)')
            .groupBy('prop.hired_plan_id'),
        'prop_counts',
        'prop_counts.hpid = p.id',
      )
      .select('p.id', 'plan_id')
      .addSelect('p.plan_name', 'plan_name')
      .addSelect('p.highlight_limit', 'highlight_limit')
      .addSelect('p.visibility', 'visibility')
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
      .setParameter('excludedStatuses', [PropertyStatus.DRAFT, PropertyStatus.ARCHIVADA])
      .getRawMany<{
        plan_id: number;
        plan_name: string;
        visibility: string;
        highlight_limit: number;
        branch_plan_ids: number[];
        used: string;
      }>();

    return rows.map((r) => {
      const used = parseInt(r.used, 10);
      return {
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        plan_visibility: r.visibility,
        highlight_limit: r.highlight_limit,
        branch_plan_ids: r.branch_plan_ids,
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
      requester.organization_id !== orgId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para operar sobre este usuario',
      );
    }

    const plan = await this.repo.findOne({
      where: { id: dto.planId, deleted: false },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const mpPayment = await this.validateMercadoPagoPayment(dto);
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const userPlan = this.userPlanRepo.create({
      user_id: userId,
      plan_id: dto.planId,
      amount_hired: 1,
      plan_price_paid: plan.price,
      plan_name_hired: plan.plan_name,
      mercadopago_response: mpPayment,
      start_date: now,
      end_date: endDate,
      active: true,
      organization_id: orgId,
    });

    console.log("Creating UserPlan with data:", userPlan);
    return this.userPlanRepo.save(userPlan);
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
            .select('prop.hired_plan_id', 'hpid')
            .addSelect('COUNT(prop.id)', 'cnt')
            .from(Property, 'prop')
            .where('prop.user_id = :userId')
            .andWhere('prop.deleted = false')
            .andWhere('prop.status NOT IN (:...excludedStatuses)')
            .groupBy('prop.hired_plan_id'),
        'prop_counts',
        'prop_counts.hpid = p.id',
      )
      .select('p.id', 'plan_id')
      .addSelect('p.plan_name', 'plan_name')
      .addSelect('p.highlight_limit', 'highlight_limit')
      .addSelect('p.visibility', 'visibility')
      .addSelect('ARRAY_AGG(up.id)', 'user_plan_ids')
      .addSelect('COALESCE(MAX(prop_counts.cnt), 0)', 'used')
      .where('up.user_id = :userId', { userId })
      .andWhere('up.active = true')
      .andWhere('up.end_date >= :now', { now: new Date() })
      .andWhere('p.deleted = false')
      .andWhere('p.is_active = true')
      .groupBy('p.id')
      .addGroupBy('p.plan_name')
      .addGroupBy('p.highlight_limit')
      .setParameter('excludedStatuses', [PropertyStatus.DRAFT, PropertyStatus.ARCHIVADA])
      .getRawMany<{
        plan_id: number;
        plan_name: string;
        highlight_limit: number;
        visibility: string;
        user_plan_ids: number[];
        used: string;
      }>();

    return rows.map((r) => {
      const used = parseInt(r.used, 10);
      return {
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        plan_visibility: r.visibility,
        highlight_limit: r.highlight_limit,
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

    const orgId = targetUser.organization?.id;
    if (
      requester.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      requester.organization_id !== orgId
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

  private async validateMercadoPagoPayment(
    dto: PlanPaymentDto,
  ): Promise<MercadoPagoPaymentResponse> {
    const payment = await this.mercadopagoPayment(dto);

    console.log("MercadoPago payment status:", payment);
    if (payment.status !== 'approved') {
      throw new BadRequestException(
        `Pago MercadoPago no aprobado. status=${payment.status}, detail=${payment.status_detail ?? 'n/a'}`,
      );
    }

    return payment;
  }

  private async mercadopagoPayment(
    params: PlanPaymentDto, 
  ): Promise<MercadoPagoPaymentResponse> {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new InternalServerErrorException(
        'Falta configurar MERCADOPAGO_ACCESS_TOKEN',
      );
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const paymentUrl = `https://api.mercadopago.com/v1/payments`;
    const paymentResponse = await fetch(paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: params.transaction_amount,
        token: params.token,
        description: params.description,
        installments: params.installments,
        payment_method_id: params.payment_method_id,
        payer: params.payer,
      }),
    });

    console.log("RAW ENDPOINT:", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: params.transaction_amount,
        token: params.token,
        description: params.description,
        installments: params.installments,
        payment_method_id: params.payment_method_id,
        payer: params.payer,
      }),
    });

    console.log("MercadoPago payment response status:", paymentResponse);

    if (!paymentResponse.ok) {
      const body = await paymentResponse.text();
      let errorMessage = `No se pudo consultar MercadoPago (${paymentResponse.status})`;
      try {
        const errorBody = JSON.parse(body) as MercadoPagoErrorResponse;
        console.log("MercadoPago error response body:", errorBody);
        const causeCode = errorBody.cause?.[0]?.code?.toString() ?? '';
        if (causeCode === '205' || causeCode.includes('cardNumber')) {
          errorMessage = 'El número de tarjeta no es válido';
        } else if (causeCode === '208' || causeCode.includes('cardExpirationMonth')) {
          errorMessage = 'Mes de vencimiento inválido';
        } else if (causeCode === '209' || causeCode.includes('cardExpirationYear')) {
          errorMessage = 'Año de vencimiento inválido';
        } else if (causeCode === '214' || causeCode.includes('identificationNumber')) {
          errorMessage = 'Número de documento inválido';
        } else if (causeCode === '316' || causeCode.includes('cardholderName')) {
          errorMessage = 'Nombre del titular inválido';
        } else if (causeCode === 'E301' || causeCode.includes('securityCode')) {
          errorMessage = 'Código de seguridad inválido';
        } else if (errorBody.message) {
          console.log("MercadoPago error message:", errorBody.message);
          errorMessage = `Error al procesar el pago. Verifique los datos e intente nuevamente.`;
        }
      } catch {
        // body is not JSON, keep generic message
      }
      throw new BadRequestException(errorMessage);
    }

    return (await paymentResponse.json()) as MercadoPagoPaymentResponse;
  }
}
