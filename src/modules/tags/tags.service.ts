import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { TagMapping } from './entities/tag-mapping.entity';
import { TagType } from '../../common/enums';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private repo: Repository<Tag>,
    @InjectRepository(TagMapping)
    private tagMappingRepo: Repository<TagMapping>,
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

  /**
   * Busca mapeos de tags para un partner específico
   */
  async findTagMappings(partner: string, partnerTagIds: string[]): Promise<TagMapping[]> {
    if (!partnerTagIds.length) return [];
    
    return this.tagMappingRepo.find({
      where: {
        partner,
        partner_tag_id: In(partnerTagIds),
      }
    });
  }

  /**
   * Busca mapeos por nombres de tags del partner
   */
  async findTagMappingsByName(partner: string, partnerTagNames: string[]): Promise<TagMapping[]> {
    if (!partnerTagNames.length) return [];
    
    return this.tagMappingRepo.find({
      where: {
        partner,
        partner_tag_name: In(partnerTagNames),
      }
    });
  }

  /**
   * Procesa tags de Tokko y retorna tags mapeados y no mapeados
   */
  async processTokkoTags(tokkoTags: any[]): Promise<{
    mappedTagIds: number[];
    unmappedTags: { name: string; type: string; id?: string }[];
  }> {
    if (!tokkoTags?.length) {
      return { mappedTagIds: [], unmappedTags: [] };
    }

    // Extraer IDs y nombres de los tags de Tokko
    const tagIds = tokkoTags.map(tag => tag.id?.toString()).filter(Boolean);
    const tagNames = tokkoTags.map(tag => tag.name).filter(Boolean);

    // Buscar mapeos por ID y por nombre
    const [mappingsByIds, mappingsByNames] = await Promise.all([
      this.findTagMappings('tokko', tagIds),
      this.findTagMappingsByName('tokko', tagNames)
    ]);

    // Combinar mappeos y eliminar duplicados
    const allMappings = [...mappingsByIds, ...mappingsByNames];
    const uniqueMappings = allMappings.filter((mapping, index, self) => 
      index === self.findIndex(m => m.id === mapping.id)
    );

    // Separar tags mapeados y no mapeados
    const mappedTagIds: number[] = [];
    const mappedPartnerTags = new Set<string>();

    uniqueMappings.forEach(mapping => {
      if (mapping.metroprop_tag_id) {
        const metropropId = parseInt(mapping.metroprop_tag_id);
        if (!isNaN(metropropId)) {
          mappedTagIds.push(metropropId);
        }
      }
      
      // Trackear qué tags ya fueron mapeados
      if (mapping.partner_tag_id) mappedPartnerTags.add(mapping.partner_tag_id);
      if (mapping.partner_tag_name) mappedPartnerTags.add(mapping.partner_tag_name);
    });

    // Encontrar tags no mapeados
    const unmappedTags = tokkoTags.filter(tag => {
      return !mappedPartnerTags.has(tag.id?.toString()) && 
             !mappedPartnerTags.has(tag.name);
    }).map(tag => ({
      name: tag.name,
      type: tag.type,
      id: tag.id?.toString()
    }));

    return {
      mappedTagIds: [...new Set(mappedTagIds)], // Eliminar duplicados
      unmappedTags
    };
  }
}