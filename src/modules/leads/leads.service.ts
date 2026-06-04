import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
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
import { PropertiesService, PropertyCard } from '../properties/properties.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly propertiesService: PropertiesService,
  ) {}

  async findAll(filters: LeadFiltersDto = {}): Promise<Lead[]> {
    const {
      id,
      email,
      name,
      phone,
      property_id,
      organization_id,
      user_id,
      deleted,
      highlighted,
      blocked,
      unread,
      lead_state,
      contact_type,
      limit = 20,
      offset = 0,
    } = filters;

    const queryBuilder = this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.property', 'property')
      .leftJoinAndSelect(
        'property.images',
        'property_image',
        `property_image.id = (
          SELECT pi.id
          FROM property_images pi
          WHERE pi."propertyId" = property.id
          ORDER BY COALESCE(pi.order_position, 2147483647) ASC, pi.id ASC
          LIMIT 1
        )`,
      )
      .orderBy('lead.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (id !== undefined) {
      queryBuilder.andWhere('lead.id = :id', { id });
    }

    if (organization_id !== undefined) {
      queryBuilder.andWhere('lead.organization_id = :organization_id', { organization_id });
    }

    if (property_id !== undefined) {
      queryBuilder.andWhere('lead.property_id = :property_id', { property_id });
    }

    if (email) {
      queryBuilder.andWhere('lead.email ILIKE :email', { email: `%${email}%` });
    }

    if (name) {
      queryBuilder.andWhere('lead.name ILIKE :name', { name: `%${name}%` });
    }

    if (phone) {
      queryBuilder.andWhere('lead.phone ILIKE :phone', { phone: `%${phone}%` });
    }

    if (user_id !== undefined) {
      queryBuilder.andWhere('lead.user_id = :user_id', { user_id });
    }

    if (deleted !== undefined) {
      queryBuilder.andWhere('lead.deleted = :deleted', { deleted });
    } else {
      queryBuilder.andWhere('lead.deleted = false');
    }

    if (highlighted !== undefined) {
      queryBuilder.andWhere('lead.highlighted = :highlighted', { highlighted });
    }

    if (blocked !== undefined) {
      queryBuilder.andWhere('lead.blocked = :blocked', { blocked });
    }

    if (unread !== undefined) {
      queryBuilder.andWhere('lead.unread = :unread', { unread });
    }

    if (lead_state !== undefined) {
      queryBuilder.andWhere('lead.lead_state = :lead_state', { lead_state });
    }

    if (contact_type !== undefined) {
      queryBuilder.andWhere('lead.contact_type = :contact_type', { contact_type });
    }

    return queryBuilder.getMany();
  }

  async getLeadProperties(filters: { email: string }): Promise<(PropertyCard & { lead_date: Date })[]> {
    const leads = await this.leadsRepository.find({
      where: { email: filters.email, deleted: false },
      order: { created_at: 'DESC' },
    });

    if (!leads.length) return [];

    const dateByPropertyId = new Map<number, Date>();
    for (const lead of leads) {
      if (lead.property_id === undefined) continue;
      const existing = dateByPropertyId.get(lead.property_id);
      if (!existing || lead.created_at > existing) {
        dateByPropertyId.set(lead.property_id, lead.created_at);
      }
    }

    const propertyIds = [...dateByPropertyId.keys()];
    if (!propertyIds.length) return [];

    const cards = await this.propertiesService.getPropertiesCardsByIds(propertyIds);

    return cards.map((card) => ({
      ...card,
      lead_date: dateByPropertyId.get(card.id)!,
    }));
  }

  async findOne(id: number): Promise<Lead> {
    const lead = await this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.property', 'property')
      .leftJoinAndSelect(
        'property.images',
        'property_image',
        `property_image.id = (
          SELECT pi.id
          FROM property_images pi
          WHERE pi."propertyId" = property.id
          ORDER BY COALESCE(pi.order_position, 2147483647) ASC, pi.id ASC
          LIMIT 1
        )`,
      )
      .where('lead.id = :id', { id })
      .andWhere('lead.deleted = false')
      .getOne();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    if (createLeadDto.user_id !== undefined) {
      await this.validateUserExists(createLeadDto.user_id);
    }

    const propertyValid = await this.validatePropertyBelongsToOrganization(
      createLeadDto.property_id,
      createLeadDto.organization_id,
    );
    if (!propertyValid) {
      throw new BadRequestException('The property does not belong to the organization');
    }

    const lead = this.leadsRepository.create({
      ...createLeadDto,
    });

    const storedLead = await this.leadsRepository.save(lead);

    this.notifyLead(storedLead).catch((err) =>
      this.logger.error('Error al notificar lead', err),
    );

    return storedLead;
  }

  async update(id: number, updateLeadDto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(id);
    const nextOrganizationId = updateLeadDto.organization_id ?? lead.organization_id;
    const nextPropertyId = updateLeadDto.property_id ?? lead.property_id;
    if (nextPropertyId !== undefined) {
      const propertyValid = await this.validatePropertyBelongsToOrganization(
        nextPropertyId,
        nextOrganizationId,
      );
      if (!propertyValid) {
        throw new BadRequestException('The property does not belong to the organization');
      }
    }

    if (updateLeadDto.user_id !== undefined) {
      await this.validateUserExists(updateLeadDto.user_id);
    }

    Object.assign(lead, {
      name: updateLeadDto.name ?? lead.name,
      email: updateLeadDto.email ?? lead.email,
      country_code: updateLeadDto.country_code ?? lead.country_code,
      phone: updateLeadDto.phone ?? lead.phone,
      message: updateLeadDto.message ?? lead.message,
      organization_id: nextOrganizationId,
      user_id: updateLeadDto.user_id !== undefined ? updateLeadDto.user_id : lead.user_id,
      property_id: nextPropertyId,
      highlighted: updateLeadDto.highlighted ?? lead.highlighted,
      blocked: updateLeadDto.blocked ?? lead.blocked,
      unread: updateLeadDto.unread ?? lead.unread,
      lead_state: updateLeadDto.lead_state ?? lead.lead_state,
      deleted: updateLeadDto.deleted ?? lead.deleted,
    });

    return this.leadsRepository.save(lead);
  }

  async remove(id: number): Promise<void> {
    const lead = await this.findOne(id);
    lead.deleted = true;
    await this.leadsRepository.save(lead);
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

  private async validateUserExists(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!user) {
      throw new BadRequestException('user_id does not reference an existing user');
    }
  }

  async findAllByOrganization(organizationId: number): Promise<Lead[]> {
    return this.leadsRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.property', 'property')
      .leftJoinAndSelect(
        'property.images',
        'property_image',
        `property_image.id = (
          SELECT pi.id
          FROM property_images pi
          WHERE pi."propertyId" = property.id
          ORDER BY COALESCE(pi.order_position, 2147483647) ASC, pi.id ASC
          LIMIT 1
        )`,
      )
      .where('lead.organization_id = :organizationId', { organizationId })
      .andWhere('lead.deleted = false')
      .orderBy('lead.created_at', 'DESC')
      .getMany();
  }

  private async notifyLead(lead: Lead): Promise<void> {
    const property = await this.propertyRepository.findOne({
      where: { id: lead.property_id },
      select: ['id', 'reference_code', 'publication_id', 'user_id', 'organization_id', 'publication_title'],
    });

    if (!property) return;

    const organization = await this.organizationRepository.findOne({
      where: { id: property.organization_id },
      select: ['id', 'source_partner_id', 'company_name', 'tokko_key'],
    });

    if (!organization) return;

    const message = lead.message ?? '';
    const contactCountryCode = lead.country_code;
    const contactPhone = lead.phone;

    if (organization.source_partner_id) {
      const partner = await this.partnerRepository.findOne({
        where: { id: organization.source_partner_id },
        select: ['id', 'name'],
      });

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
              errorContext: {
                lead: {
                  id: lead.id,
                  name: lead.name,
                  email: lead.email,
                  phone: lead.phone,
                  country_code: lead.country_code,
                  property_id: lead.property_id!,
                  message: lead.message,
                },
              },
            });
            break;

          default:
            this.logger.warn(`Partner "${partner.name}" sin handler de notificación implementado`);
        }
        return;
      }
    }

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