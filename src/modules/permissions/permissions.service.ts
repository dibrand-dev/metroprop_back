import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private repo: Repository<Permission>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findOne(id: number) {
    const permission = await this.repo.findOne({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  create(data: Partial<Permission>) {
    const permission = this.repo.create(data);
    return this.repo.save(permission);
  }

  async update(id: number, data: Partial<Permission>) {
    const permission = await this.findOne(id);
    Object.assign(permission, data);
    return this.repo.save(permission);
  }

  async remove(id: number) {
    const permission = await this.findOne(id);
    return this.repo.remove(permission);
  }
}