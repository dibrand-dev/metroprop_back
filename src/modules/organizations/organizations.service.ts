import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
  ) {}

  findAll() {
    return this.repo.find({ where: { deleted: false } });
  }

  async findOne(id: number) {
    const org = await this.repo.findOne({ where: { id, deleted: false } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  create(data: Partial<Organization>) {
    const org = this.repo.create(data);
    return this.repo.save(org);
  }

  async update(id: number, data: Partial<Organization>) {
    const org = await this.findOne(id);
    Object.assign(org, data);
    return this.repo.save(org);
  }

  async remove(id: number) {
    const org = await this.findOne(id);
    org.deleted = true; // borrado lógico
    return this.repo.save(org);
  }
}