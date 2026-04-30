import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadProperty } from './entities/lead-property.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(LeadProperty)
    private readonly leadPropertyRepository: Repository<LeadProperty>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async findAll(): Promise<Lead[]> {
    return this.leadsRepository.find({
      relations: ['lead_properties'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Lead> {
    const lead = await this.leadsRepository.findOne({
      where: { id },
      relations: ['lead_properties'],
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    await this.validatePropertyBelongsToOrganization(
      createLeadDto.property_id,
      createLeadDto.organization_id,
    );

    let lead = await this.findByEmailAndOrganization(
      createLeadDto.email,
      createLeadDto.organization_id,
    );

    if (!lead) {
      lead = this.leadsRepository.create({
        name: createLeadDto.name,
        email: createLeadDto.email,
        country_code: createLeadDto.country_code,
        phone: createLeadDto.phone,
        organization_id: createLeadDto.organization_id,
      });
      lead = await this.leadsRepository.save(lead);
    }

    await this.createLeadPropertyRelation(
      lead.id,
      createLeadDto.property_id,
      createLeadDto.message,
    );

    return this.findOne(lead.id);
  }

  async update(id: number, updateLeadDto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(id);
    const nextOrganizationId = updateLeadDto.organization_id ?? lead.organization_id;
    const nextEmail = updateLeadDto.email ?? lead.email;

    const duplicatedLead = await this.findByEmailAndOrganization(nextEmail, nextOrganizationId);
    if (duplicatedLead && duplicatedLead.id !== id) {
      throw new ConflictException('A lead with that email already exists for the organization');
    }

    if (updateLeadDto.property_id !== undefined) {
      await this.validatePropertyBelongsToOrganization(
        updateLeadDto.property_id,
        nextOrganizationId,
      );
    }

    Object.assign(lead, {
      name: updateLeadDto.name ?? lead.name,
      email: nextEmail,
      country_code: updateLeadDto.country_code ?? lead.country_code,
      phone: updateLeadDto.phone ?? lead.phone,
      organization_id: nextOrganizationId,
    });

    await this.leadsRepository.save(lead);

    if (updateLeadDto.property_id !== undefined) {
      await this.createLeadPropertyRelation(
        lead.id,
        updateLeadDto.property_id,
        updateLeadDto.message,
      );
    }

    return this.findOne(lead.id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.leadsRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('Lead not found');
    }
  }

  private async findByEmailAndOrganization(email: string, organizationId: number): Promise<Lead | null> {
    return this.leadsRepository.findOne({
      where: {
        email,
        organization_id: organizationId,
      },
    });
  }

  private async validatePropertyBelongsToOrganization(
    propertyId: number,
    organizationId: number,
  ): Promise<void> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
      select: ['id', 'organization_id'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.organization_id !== organizationId) {
      throw new BadRequestException('Property does not belong to the provided organization');
    }
  }

  private async createLeadPropertyRelation(
    leadId: number,
    propertyId: number,
    message?: string,
  ): Promise<LeadProperty> {
    const leadProperty = this.leadPropertyRepository.create({
      lead_id: leadId,
      property_id: propertyId,
      message,
    });

    return this.leadPropertyRepository.save(leadProperty);
  }
}