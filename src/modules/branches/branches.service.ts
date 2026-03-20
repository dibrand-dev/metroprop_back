import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectRepository(Branch)
    private repo: Repository<Branch>,
  ) {}

  findAll() {
    return this.repo.find({ relations: ['organization'] });
  }

  async findOne(id: number) {
    const branch = await this.repo.findOne({ where: { id }, relations: ['organization'] });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async findByExternalReference(organizationId: number, externalRef: string): Promise<Branch | null> {
    return this.repo.findOne({
      where: {
        external_reference: externalRef,
        organization: { id: organizationId },
        deleted: false,
      } as any,
      relations: ['organization'],
    });
  }

  create(data: CreateBranchDto | (Partial<Branch> & { organizationId?: number })): Promise<Branch> {
    const { organizationId, ...rest } = data as any;
    const branch = this.repo.create(rest as Partial<Branch>);
    if (organizationId) {
      (branch as any).organization = { id: organizationId };
    }
    
    return this.repo.save(branch);
  }

  async update(id: number, data: UpdateBranchDto | (Partial<Branch> & { organizationId?: number })): Promise<Branch> {
    const branch = await this.findOne(id);
    const { organizationId, ...rest } = data as any;
    Object.assign(branch, rest);
    if (organizationId !== undefined) {
      (branch as any).organization = organizationId ? { id: organizationId } : null;
    }
    return this.repo.save(branch as Branch);
  }

  async remove(id: number) {
    const branch = await this.findOne(id);
    return this.repo.remove(branch);
  }
}