import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadProperty } from './entities/lead-property.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Property } from '../properties/entities/property.entity';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { Partner } from '../partners/entities/partner.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../../common/email/email.service';
import { notifyTokkoContact } from '../../common/helpers/tokko-helper';
import { TOKKO_PARTNER_NAME, API_BASE_URL } from '../../common/constants';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(LeadProperty)
    private readonly leadPropertyRepository: Repository<LeadProperty>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  async findAll(filters: LeadFiltersDto = {}): Promise<Lead[]> {
    const {
      id,
      email,
      name,
      phone,
      property_id,
      organization_id,
      owner_user_id,
      limit = 20,
      offset = 0,
    } = filters;

    const queryBuilder = this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.lead_properties', 'leadProperty')
      .orderBy('lead.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .distinct(true);

    if (id !== undefined) {
      queryBuilder.andWhere('lead.id = :id', { id });
    }

    if (organization_id !== undefined) {
      queryBuilder.andWhere('lead.organization_id = :organization_id', {
        organization_id,
      });
    }

    if (property_id !== undefined) {
      queryBuilder.andWhere('leadProperty.property_id = :property_id', {
        property_id,
      });
    }

    if (email) {
      queryBuilder.andWhere('lead.email ILIKE :email', {
        email: `%${email}%`,
      });
    }

    if (name) {
      queryBuilder.andWhere('lead.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    if (phone) {
      queryBuilder.andWhere('lead.phone ILIKE :phone', {
        phone: `%${phone}%`,
      });
    }

    if (owner_user_id !== undefined) {
      queryBuilder.andWhere('lead.owner_user_id = :owner_user_id', { owner_user_id });
    }

    return queryBuilder.getMany();
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
    let lead: Lead | null = null;

    // 1. Buscar lead existente: por email+org o por email+owner_user
    if (createLeadDto.organization_id) {
      lead = await this.findByEmailAndOrganization(
        createLeadDto.email,
        createLeadDto.organization_id,
      );
    } else if (createLeadDto.owner_user_id !== undefined) {

      if (createLeadDto.owner_user_id !== undefined) {
        await this.validateOwnerUserExists(createLeadDto.owner_user_id);
      }
      lead = await this.findByEmailAndOwnerUser(
        createLeadDto.email,
        createLeadDto.owner_user_id,
      );
    }

    if (!lead) {
      lead = this.leadsRepository.create({
        name: createLeadDto.name,
        email: createLeadDto.email,
    //    country_code: createLeadDto.country_code,
     //   phone: createLeadDto.phone,
        organization_id: createLeadDto.organization_id,
        owner_user_id: createLeadDto.owner_user_id,
      });
      lead = await this.leadsRepository.save(lead);
    }

    // 4. Crear lead_property con el teléfono y el mensaje
    await this.createLeadPropertyRelation(
      lead.id,
      createLeadDto.property_id,
      createLeadDto.message,
      createLeadDto.country_code,
      createLeadDto.phone,
    );

    const storedLead = await this.findOne(lead.id);

    this.notifyLead(storedLead).catch((err) =>
      this.logger.error('Error al notificar lead', err),
    );

    return storedLead;
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
      const propertyValid = await this.validatePropertyBelongsToOrganization(
        updateLeadDto.property_id,
        nextOrganizationId,
      );
      if (!propertyValid) {
        throw new BadRequestException('The property does not belong to the organization');
      }
    }

    if (updateLeadDto.owner_user_id !== undefined) {
      await this.validateOwnerUserExists(updateLeadDto.owner_user_id);
    }

    Object.assign(lead, {
      name: updateLeadDto.name ?? lead.name,
      email: nextEmail,
      organization_id: nextOrganizationId,
      owner_user_id: updateLeadDto.owner_user_id !== undefined ? updateLeadDto.owner_user_id : lead.owner_user_id,
    });

    await this.leadsRepository.save(lead);

    if (updateLeadDto.property_id !== undefined) {
      await this.createLeadPropertyRelation(
        lead.id,
        updateLeadDto.property_id,
        updateLeadDto.message,
        updateLeadDto.country_code,
        updateLeadDto.phone,
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

  private async findByEmailAndOrganization(email: string, organizationId?: number): Promise<Lead | null> {
    return this.leadsRepository.findOne({
      where: {
        email,
        organization_id: organizationId,
      },
    });
  }

  private async findByEmailAndOwnerUser(email: string, ownerUserId: number): Promise<Lead | null> {
    return this.leadsRepository.findOne({
      where: {
        email,
        owner_user_id: ownerUserId,
      },
    });
  }

  private async validatePropertyBelongsToOrganization(
    propertyId: number,
    organizationId?: number,
  ): Promise<boolean> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
      select: ['id', 'organization_id'],
    });

    if (!property) return false;
    if (organizationId !== undefined && property.organization_id !== organizationId) return false;
    return true;
  }

  private async validateOwnerUserExists(ownerUserId: number): Promise<void> {
    const ownerUser = await this.userRepository.findOne({
      where: { id: ownerUserId },
      select: ['id'],
    });

    if (!ownerUser) {
      throw new BadRequestException('owner_user_id does not reference an existing user');
    }
  }

  private async createLeadPropertyRelation(
    leadId: number,
    propertyId: number,
    message?: string,
    country_code?: string,
    phone?: string,
  ): Promise<LeadProperty> {
    const leadProperty = this.leadPropertyRepository.create({
      lead_id: leadId,
      property_id: propertyId,
      message,
      country_code,
      phone,
    });

    return this.leadPropertyRepository.save(leadProperty);
  }

  async findAllByOrganization(organizationId: number): Promise<Lead[]> {
    return this.leadsRepository.find({
      where: { organization_id: organizationId },
      relations: ['lead_properties'],
      order: { created_at: 'DESC' },
    });
  }

  private async notifyLead(lead: Lead): Promise<void> {
    // Obtener el lead_property más reciente para extraer property y mensaje
    const leadProperty = await this.leadPropertyRepository.findOne({
      where: { lead_id: lead.id },
      order: { created_at: 'DESC' },
    });

    if (!leadProperty) return;

    // Obtener la propiedad con user_id y organization_id
    const property = await this.propertyRepository.findOne({
      where: { id: leadProperty.property_id },
      select: ['id', 'reference_code', 'publication_id', 'user_id', 'organization_id', 'publication_title'],
    });

    if (!property) return;

    // Obtener la organización para saber si tiene partner
    const organization = await this.organizationRepository.findOne({
      where: { id: property.organization_id },
      select: ['id', 'source_partner_id', 'company_name'],
    });

    if (!organization) return;

    const message = leadProperty.message ?? '';
    const contactCountryCode = leadProperty.country_code ?? lead.country_code;
    const contactPhone = leadProperty.phone ?? lead.phone;

    // ── Con partner (ej: Tokko) ──────────────────────────────────────────────
    if (organization.source_partner_id) {
      const partner = await this.partnerRepository.findOne({
        where: { id: organization.source_partner_id },
        select: ['id', 'name'],
      });

      // Por ahora, deshabilitado
      if (partner && 1 > 2) {
        switch (partner.name) {
          case TOKKO_PARTNER_NAME:
            await notifyTokkoContact({
              api_key: organization.tokko_key ?? '',
              publication_id: property.publication_id ?? property.reference_code,
              name: lead.name,
              mail: lead.email,
              comment: message,
              phone: contactPhone ? `+${contactCountryCode ?? ''} ${contactPhone}`.trim() : undefined,
              errorContext: { lead, leadProperty },
            });
            break;

          default:
            this.logger.warn(`Partner "${partner.name}" sin handler de notificación implementado`);
        }
        return;
      }
    }

    // ── Sin partner: org registrada en el sitio → email al user de la propiedad
    if (!property.user_id) return;

    const assignedUser = await this.userRepository.findOne({
      where: { id: property.user_id },
      select: ['id', 'email', 'name'],
    });

    if (!assignedUser?.email) return;

    const propertyLabel = property.publication_title ?? property.reference_code ?? `#${property.id}`;
    const contactsUrl = `${API_BASE_URL}/contactos`;

    await this.emailService.sendLeadNotificationEmail({
      to: assignedUser.email,
      recipientName: assignedUser.name,
      propertyLabel,
      lead: {
        name: lead.name,
        email: lead.email,
        phone: contactPhone ?? undefined,
        country_code: contactCountryCode ?? undefined,
      },
      message,
      contactsUrl,
    });
  }
}