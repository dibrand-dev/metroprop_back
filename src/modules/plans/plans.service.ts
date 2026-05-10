import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { BranchPlan } from './entities/branch-plan.entity';
import { Branch } from '../branches/entities/branch.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateBranchPlanDto } from './dto/create-branch-plan.dto';
import { UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
    @InjectRepository(BranchPlan)
    private readonly branchPlanRepo: Repository<BranchPlan>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
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

  async remove(id: number): Promise<{ message: string }> {
    const plan = await this.findOne(id);
    plan.deleted = true;
    plan.deleted_at = new Date();
    await this.repo.save(plan);
    return { message: 'Plan deleted successfully' };
  }

  // ─── Branch Plan methods ───────────────────────────────────────────────────

  async createBranchPlan(
    dto: CreateBranchPlanDto,
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

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const branchPlan = this.branchPlanRepo.create({
      branch_id: branchId,
      plan_id: dto.plan_id,
      amount_hired: dto.amount_hired,
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
}
