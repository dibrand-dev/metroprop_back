import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private repo: Repository<Role>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findOne(id: number) {
    const role = await this.repo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  create(data: Partial<Role>) {
    const role = this.repo.create(data);
    return this.repo.save(role);
  }

  async update(id: number, data: Partial<Role>) {
    const role = await this.findOne(id);
    Object.assign(role, data);
    return this.repo.save(role);
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    return this.repo.remove(role);
  }
}