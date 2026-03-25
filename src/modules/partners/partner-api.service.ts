import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { PropertyAttached } from '../properties/entities/property-attached.entity';
import { Partner } from './entities/partner.entity';

import { PropertiesService } from '../properties/properties.service';
import { PropertyWriteService } from '../properties/property-write.service';
import { RegistrationService } from '../registration/registration.service';

import { CreateOrganizationRegistrationDto } from '../registration/dto/create-organization-registration.dto';
import { CreatePropertyDto } from '../properties/dto/create-property.dto';
import { UpdatePropertyDto } from '../properties/dto/update-property.dto';

@Injectable()
export class PartnerApiService {
  private readonly logger = new Logger(PartnerApiService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyImage)
    @InjectRepository(PropertyAttached)
    private readonly propertiesService: PropertiesService,
    private readonly propertyWriteService: PropertyWriteService,
    private readonly registrationService: RegistrationService,
    
  ) {}

  // ================================================================
  // CREATE ORGANIZATION + BRANCH + ADMIN USER 
  // ================================================================

  async createOrganization(
    dto: CreateOrganizationRegistrationDto,
    partner: Partner,
  ): Promise<{ organization_id: number; branch_id: number; admin_user_id: number }> {
    return this.registrationService.createOrganization(dto, partner);
  }

  // ================================================================
  // CREATE / UPSERT PROPERTY
  // ================================================================

  async createOrUpsertProperty(
    dto: CreatePropertyDto,
    partner: Partner,
  ): Promise<{ data: Property; created: boolean; warnings?: string[] }> {

    // 1. Resolve the branch + org from branch_reference_id, scoped to partner
    this.logger.log(`[createOrUpsertProperty] INICIO - dto: ${JSON.stringify(dto)}`);
    console.log('[createOrUpsertProperty] INICIO', dto);
    if (typeof dto.branch_reference_id !== 'number') {
      this.logger.error('[createOrUpsertProperty] branch_reference_id inválido:', dto.branch_reference_id);
      console.error('[createOrUpsertProperty] branch_reference_id inválido:', dto.branch_reference_id);
      throw new BadRequestException('branch_reference_id es obligatorio y debe ser un número');
    }

    const branchId = dto.branch_reference_id;
    const { organization, branch } = await this.resolveBranchForPartner(
      branchId, // Usamos este campo para que el partner haga referencia a la branch pero es el ID realmente lo que buscamos
      partner,
    );
    this.logger.log(`[createOrUpsertProperty] Resolved organization ${organization.id}, branch ${branch.id}`);
    console.log('[createOrUpsertProperty] Resolved organization:', organization.id, 'branch:', branch.id);

    // 2. Resolve agent user (falls back to org admin, may produce warnings)
    const orgWithAdmin = await this.organizationRepo.findOne({
      where: { id: organization.id },
      relations: ['admin_user'],
    });
    const adminUserId = orgWithAdmin?.admin_user?.id;
    this.logger.log(`[createOrUpsertProperty] orgWithAdmin: ${JSON.stringify(orgWithAdmin)}`);
    console.log('[createOrUpsertProperty] orgWithAdmin:', orgWithAdmin);
    const { userId, agentWarnings } = await this.resolveAgentUser(
      dto.agent_email,
      dto.agent_name,
      organization.id,
      branch.id,
      adminUserId
    );
    this.logger.log(`[createOrUpsertProperty] agentUserId: ${userId}, agentWarnings: ${JSON.stringify(agentWarnings)}`);
    console.log('[createOrUpsertProperty] agentUserId:', userId, 'agentWarnings:', agentWarnings);

    // 3. Check if property already exists (upsert by reference_code + org)
    const existing = await this.propertyRepo.findOne({
      where: {
        reference_code: dto.reference_code,
        deleted: false,
        organization_id: organization.id ,
      }
    });
    this.logger.log(`[createOrUpsertProperty] existing property: ${existing ? existing.id : 'none'}`);
    console.log('[createOrUpsertProperty] existing property:', existing ? existing.id : 'none');

    dto.organization_id = organization.id;
    dto.user_id = userId;
    dto.branch_id = branch.id; 

    // UPDATE EXISTING PROPERTY
    if (existing) {
      const { branch_reference_id, ...rest } = dto;
      try {
        // Extraer datos base y relaciones
        const { tags, images, videos, multimedia360, attached, ...propertyData } = rest as any;

        this.logger.log(`[createOrUpsertProperty] Actualizando propiedad existente ${existing.id}`);
        console.log('[createOrUpsertProperty] Actualizando propiedad existente', existing.id);
        const { warnings } = await this.propertyWriteService.updatePropertyCore(
          existing,
          propertyData,
          { tags, images, videos, multimedia360, attached },
        );

        const updatedProperty = await this.propertyRepo.findOne({
          where: {
            id: existing.id,
            deleted: false,
          },
          relations: ['images', 'tags', 'videos', 'attached'],
        }); 
        this.logger.log(`[createOrUpsertProperty] updatedProperty: ${JSON.stringify(updatedProperty)}`);
        console.log('[createOrUpsertProperty] updatedProperty:', updatedProperty);
        const allWarnings = [...agentWarnings, ...(warnings ?? [])];
        return {
          data: updatedProperty!,
          created: false,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
        };
      } catch (err) {
        this.logger.error('[createOrUpsertProperty] ERROR actualizando propiedad', err);
        console.error('[createOrUpsertProperty] ERROR actualizando propiedad', err);
        throw err;
      }
    } 
    
    // CREA NUEVA PROPIEDAD
    try {
      // 1. Extraer las relaciones y multimedia del DTO
      const {
        images,
        tags,
        videos,
        multimedia360,
        attached,
        ...propertyData
      } = dto as any;

      // Crear la propiedad base y sincronizar tags, videos, multimedia360, images y attached
      const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
        { ...propertyData, deleted: false },
        { tags, videos, multimedia360, images, attached },
      );

      const finalProperty = await this.propertyRepo.findOne({
        where: { id: savedProperty.id },
        relations: ['images', 'tags', 'videos', 'attached'],
      });

      return {
        data: finalProperty!,
        created: true,
        warnings: warnings.length > 0 ?  warnings : undefined,
      };

    } catch (err) {
      this.logger.error('[createOrUpsertProperty] ERROR creando propiedad', err);
      throw err;
    }
  }

  // ================================================================
  // UPDATE PROPERTY (by reference_code)
  // ================================================================

  async updateProperty(
    referenceCode: string,
    dto: UpdatePropertyDto,
    partner: Partner,
  ): Promise<{ data: Property; warnings?: string[] }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    // Extraer datos base y relaciones
    const { tags, images, videos, multimedia360, attached, ...propertyData } = dto as any;
    const { warnings } = await this.propertyWriteService.updatePropertyCore(
      property,
      propertyData,
      { tags, images, videos, multimedia360, attached },
    );

    const result = await this.propertyRepo.findOne({
      where: { id: property.id },
      relations: ['images', 'tags', 'videos', 'attached'],
    });
   
    return {
      data: result!,
      warnings: warnings?.length ? warnings : undefined,
    };
  }

  // ================================================================
  // DELETE (soft) PROPERTY
  // ================================================================

  async deleteProperty(
    referenceCode: string,
    partner: Partner,
  ): Promise<{ message: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    property.deleted = true;
    property.deleted_at = new Date();
    await this.propertyRepo.save(property);

    this.logger.log(`Property ${referenceCode} soft-deleted by partner ${partner.id}`);
    return { message: `Propiedad ${referenceCode} eliminada correctamente` };
  }

  // ================================================================
  // DEACTIVATE PROPERTY (set status NO_DISPONIBLE)
  // ================================================================

  async deactivateProperty(
    referenceCode: string,
    partner: Partner,
  ): Promise<{ data: Property }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    property.status = 4 as any; // PropertyStatus.NO_DISPONIBLE
    await this.propertyRepo.save(property);

    const result = await this.propertiesService.findOne(property.id!);
    this.logger.log(`Property ${referenceCode} deactivated by partner ${partner.id}`);
    return { data: result };
  }

  async getProperty(
    referenceCode: string,
    partner: Partner,
  ): Promise<{ data: Property }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    const result = await this.propertiesService.findOne(property.id!);
    return { data: result };
  }

   /**
   * Reintentar uploads fallidos para una propiedad del partner
   */
  async resetFailedUploadsForPartner(
    referenceCode: string,
    partner: Partner,
  ) {
    // Primero validar que la propiedad pertenece al partner
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    
    if (!property.id) {
      throw new BadRequestException(`Propiedad ${referenceCode} no tiene un ID válido`);
    }
    
    // Usar el service de properties para hacer el retry
    const result = await this.propertiesService.resetFailedUploads(property.id);
    
    return {
      success: true,
      data: {
        property_reference: referenceCode,
        property_id: property.id,
        retry_results: result
      }
    };
  }

  // ================================================================
  //  PRIVATE HELPERS
  // ================================================================

  /**
   * Validates that a branch belongs to an organization owned by this partner.
   */
  private async resolveBranchForPartner(
    branchId: number,
    partner: Partner,
  ): Promise<{ organization: Organization; branch: Branch }> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId, deleted: false },
      relations: ['organization'],
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} no encontrada`);
    }

    const org = branch.organization;
    if (!org || org.deleted || org.source_partner_id !== partner.id) {
      throw new BadRequestException(
        `Branch ${branchId} no pertenece a una organización de este partner`,
      );
    }

    return { organization: org, branch };
  }

  /**
   * Resolves which user to assign as the property agent.
   *
   * Rules:
   * - No agent_email → use org admin.
   * - agent_email found in org → use that user.
   * - agent_email not found → create user (generates a random password),
   *   link to org+branch, then use them.
   * - Creation fails → fall back to org admin and return a warning.
   */
  private async resolveAgentUser(
    agentEmail: string | undefined,
    agentName: string | undefined,
    organizationId: number,
    branchId: number,
    adminUserId: number | undefined
  ): Promise<{ userId: number | undefined; agentWarnings: string[] }> {
    const agentWarnings: string[] = [];

    if (!agentEmail) {
      return { userId: adminUserId, agentWarnings };
    }

    // Look for an existing user with this email inside the organization
    const existing = await this.userRepo.findOne({
      where: { email: agentEmail, organization: { id: organizationId } },
    });

    if (existing) {
      return { userId: existing.id, agentWarnings };
    }

    // User doesn't exist yet → create them
    try {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(agentEmail, 10);

      const newUser = this.userRepo.create({
        name: agentName || agentEmail,
        email: agentEmail,
        password: hashedPassword,
        organization: { id: organizationId } as Organization,
        is_verified: true,
      });
      const savedUser = await this.userRepo.save(newUser) as unknown as User;

      // Link new user to the branch
      await this.userRepo
        .createQueryBuilder()
        .relation(User, 'branches')
        .of(savedUser)
        .add(branchId);

      this.logger.log(`Created agent user ${savedUser.id} (${agentEmail}) for org ${organizationId}`);
      return { userId: savedUser.id, agentWarnings };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      agentWarnings.push(
        `Se intentó crear el usuario agente con email ${agentEmail} pero falló (${reason}). ` +
        `La propiedad fue asignada al administrador de la organización.`,
      );
      this.logger.warn(`Failed to create agent user ${agentEmail}: ${reason}`);
      return { userId: adminUserId, agentWarnings };
    }
  }

  /**
   * Find property by reference_code scoped to the partner's organizations.
   */
  private async findPropertyByRefCode(
    referenceCode: string,
    partner: Partner,
  ): Promise<Property> {
    const orgIds = await this.organizationRepo
      .createQueryBuilder('org')
      .select('org.id')
      .where('org.source_partner_id = :partnerId', { partnerId: partner.id })
      .andWhere('org.deleted = false')
      .getMany();

    if (orgIds.length === 0) {
      throw new NotFoundException(`No se encontraron organizaciones para este partner`);
    }

    const ids = orgIds.map((o) => o.id);

    const property = await this.propertyRepo
      .createQueryBuilder('prop')
      .where('prop.reference_code = :referenceCode', { referenceCode })
      .andWhere('prop.organization_id IN (:...orgIds)', { orgIds: ids })
      .andWhere('prop.deleted = false')
      .getOne();

    if (!property) {
      throw new NotFoundException(
        `Propiedad con código ${referenceCode} no encontrada para este partner`,
      );
    }

    return property;
  }

}
