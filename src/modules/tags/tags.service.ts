import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { TagType } from '../../common/enums';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private repo: Repository<Tag>,
  ) {}

  findAll() {
    return this.repo.find({ 
      where: { is_active: true },
      order: { name: 'ASC' } 
    });
  }

  findByType(type: TagType) {
    return this.repo.find({ 
      where: { type, is_active: true },
      order: { name: 'ASC' } 
    });
  }

  async findOne(id: number) {
    const tag = await this.repo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  create(createTagDto: Partial<Tag>) {
    const tag = this.repo.create(createTagDto);
    return this.repo.save(tag);
  }

  async update(id: number, data: Partial<Tag>) {
    const tag = await this.findOne(id);
    Object.assign(tag, data);
    return this.repo.save(tag);
  }

  async remove(id: number) {
    const tag = await this.findOne(id);
    await this.repo.remove(tag);
    return { message: 'Tag deleted successfully' };
  }

  async getTagTypes() {
    const result = await this.repo
      .createQueryBuilder('tag')
      .select('DISTINCT tag.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('tag.is_active = :isActive', { isActive: true })
      .groupBy('tag.type')
      .orderBy('tag.type', 'ASC')
      .getRawMany();
    
    return result;
  }
}