import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
  ) {}

  findAll(): Promise<Plan[]> {
    return this.repo.find({
      where: { deleted: false },
      order: { plan_type: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Plan> {
    const plan = await this.repo.findOne({ where: { id, deleted: false } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const existing = await this.repo.findOne({
      where: { plan_type: dto.plan_type, deleted: false },
    });
    if (existing) {
      throw new ConflictException(
        `A plan with plan_type ${dto.plan_type} already exists`,
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
}
