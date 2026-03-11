import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { PropertyAttached } from '../properties/entities/property-attached.entity';
import { Partner } from './entities/partner.entity';

import { PropertiesService } from '../properties/properties.service';
import { PropertyWriteService } from '../properties/property-write.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../common/email/email.service';
import { MediaService } from '../../common/media/media.service';

import { PartnerCreateOrganizationDto } from './dto/partner-create-organization.dto';
import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerPatchImageDto } from './dto/partner-patch-image.dto';
import { PartnerPatchAttachedDto } from './dto/partner-patch-attached.dto';

import { MediaUploadStatus } from '../../common/enums';

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
    private readonly propertyImageRepo: Repository<PropertyImage>,
    @InjectRepository(PropertyAttached)
    private readonly propertyAttachedRepo: Repository<PropertyAttached>,
    private readonly propertiesService: PropertiesService,
    private readonly propertyWriteService: PropertyWriteService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly mediaService: MediaService,
    private readonly dataSource: DataSource,
  ) {}

  // ================================================================
  // CREATE ORGANIZATION + BRANCH + ADMIN USER
  // ================================================================

  async createOrganization(
    dto: PartnerCreateOrganizationDto,
    partner: Partner,
  ): Promise<{ organization_id: number; branch_id: number; admin_user_id: number }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Create Organization
      const organization = manager.create(Organization, {
        company_name: dto.company_name,
        company_logo: dto.company_logo,
        email: dto.email,
        address: dto.address,
        phone: dto.phone,
        alternative_phone: dto.alternative_phone,
        contact_time: dto.contact_time,
        country_id: dto.country_id,
        state_id: dto.state_id,
        location_id: dto.location_id?.toString(),
        sub_location_id: dto.sublocation_id,
        professional_type: dto.professional_type,
        cuit: dto.cuit || undefined,
        external_reference: `partner-${partner.id}-org`,
        source_partner_id: partner.id,
        deleted: false,
      });
      const savedOrg = await manager.save(Organization, organization);
      this.logger.log(`Created organization ${savedOrg.id} for partner ${partner.id}`);

      // 2. Create Branch (mirror org data)
      const branch = manager.create(Branch, {
        branch_name: dto.company_name,
        email: dto.email,
        phone: dto.phone,
        alternative_phone: dto.alternative_phone,
        contact_time: dto.contact_time,
        address: dto.address,
        country_id: dto.country_id,
        state_id: dto.state_id,
        location_id: dto.location_id?.toString(),
        sub_location_id: dto.sublocation_id,
        organization: savedOrg,
        deleted: false,
      });
      const savedBranch = await manager.save(Branch, branch);
      this.logger.log(`Created branch ${savedBranch.id} for organization ${savedOrg.id}`);

      // 3. Create Admin User
      // Check if user with this email already exists
      const existingUser = await manager.findOne(User, {
        where: { email: dto.admin_email },
      });

      if (existingUser) {
        throw new BadRequestException(
          `El email ${dto.admin_email} ya se encuentra registrado. Use otro email para el administrador.`,
        );
      }

      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(dto.admin_name, 10);

      const user = manager.create(User, {
        name: dto.admin_name,
        email: dto.admin_email,
        password: hashedPassword,
        phone: dto.admin_phone,
        organization: { id: savedOrg.id } as Organization,
        is_verified: false,
      });
      const savedUser = await manager.save(User, user);

      // Link user to branch
      await manager
        .createQueryBuilder()
        .relation(User, 'branches')
        .of(savedUser)
        .add(savedBranch.id);

      // Set as org admin
      await manager.update(Organization, savedOrg.id, {
        admin_user: { id: savedUser.id } as User,
      });

      this.logger.log(`Created admin user ${savedUser.id} (${dto.admin_email}) for organization ${savedOrg.id}`);

      // 4. Send welcome email (non-blocking)
      try {
        const verificationToken = await this.usersService.setEmailVerificationToken(savedUser.id);
        await this.emailService.sendProfessionalWelcomeEmail(
          savedUser.email,
          savedUser.name,
          verificationToken,
        );
        this.logger.log(`Welcome email sent to ${savedUser.email}`);
      } catch (emailError) {
        this.logger.error(`Error sending welcome email to ${savedUser.email}: ${emailError}`);
      }

      return {
        organization_id: savedOrg.id,
        admin_user_id: savedUser.id,
        branch_id: savedBranch.id
      };
    });
  }

  // ================================================================
  // CREATE / UPSERT PROPERTY
  // ================================================================

  async createOrUpsertProperty(
    dto: PartnerCreatePropertyDto,
    partner: Partner,
  ): Promise<{ data: Property; created: boolean; warnings?: string[] }> {
    // 1. Resolve the branch + org from branch_reference_id, scoped to partner
    const { organization, branch } = await this.resolveBranchForPartner(
      dto.branch_reference_id,
      partner,
    );

    // 2. Resolve agent user (falls back to org admin, may produce warnings)
    const orgWithAdmin = await this.organizationRepo.findOne({
      where: { id: organization.id },
      relations: ['admin_user'],
    });
    const adminUserId = orgWithAdmin?.admin_user?.id;
    const { userId, agentWarnings } = await this.resolveAgentUser(
      dto.agent_email,
      dto.agent_name,
      organization.id,
      branch.id,
      adminUserId,
    );

    // 3. Check if property already exists (upsert by reference_code + org)
    const existing = await this.propertyRepo.findOne({
      where: {
        reference_code: dto.reference_code,
        organization_id: organization.id,
        deleted: false,
      },
      relations: ['images', 'tags', 'videos', 'attached'],
    });

    if (existing) {
      const { branch_reference_id, videos, multimedia360, tags, ...scalarFields } = dto;
      const updateResult = await this.updatePropertyInternal(
        existing,
        { ...scalarFields, tags },
        organization.id,
        branch.id,
        userId,
      );

      if (videos && videos.length > 0) {
        await this.propertyWriteService.syncVideos(existing.id!, videos, false);
      }
      if (multimedia360 && multimedia360.length > 0) {
        await this.propertyWriteService.syncMultimedia360(existing.id!, multimedia360, false);
      }

      const result = await this.propertiesService.findOne(existing.id!);
      const allWarnings = [...agentWarnings, ...updateResult.warnings];
      return {
        data: result,
        created: false,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      };
    }

    // CREATE new property
    return this.createPropertyInternal(dto, organization.id, branch.id, userId, agentWarnings);
  }

  // ================================================================
  // UPDATE PROPERTY (by reference_code)
  // ================================================================

  async updateProperty(
    referenceCode: string,
    dto: PartnerUpdatePropertyDto,
    partner: Partner,
  ): Promise<{ data: Property; warnings?: string[] }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const updateResult = await this.updatePropertyInternal(property, dto);

    const result = await this.propertiesService.findOne(property.id!);
    return {
      data: result,
      warnings: updateResult.warnings.length > 0 ? updateResult.warnings : undefined,
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

  // ================================================================
  // UPLOAD IMAGE (multipart file → S3, fire-and-forget)
  // ================================================================

  async uploadImage(
    referenceCode: string,
    file: Express.Multer.File,
    description: string | undefined,
    orderPosition: number | undefined,
    isBlueprint: boolean | undefined,
    partner: Partner,
  ): Promise<{ image_reference_id: number; upload_status: string; informacion_adicional: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const imageRecord = this.propertyImageRepo.create({
      url: null,
      is_blueprint: isBlueprint ?? false,
      description,
      order_position: orderPosition,
      property: { id: property.id } as Property,
      upload_status: MediaUploadStatus.PENDING,
      retry_count: 0,
    });
    const saved = await this.propertyImageRepo.save(imageRecord);

    const fileBuffer = file.buffer;
    const mimeType = file.mimetype;
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const s3Key = this.mediaService.buildS3Key(`properties/${property.id}/images`, `${Date.now()}-${saved.id}.${ext}`);
    const url = this.mediaService.buildPublicUrl(s3Key);

    setImmediate(async () => {
      try {
        await this.mediaService.uploadFile(fileBuffer, s3Key, mimeType);
        await this.propertyImageRepo.update(saved.id!, {
          url,
          upload_status: MediaUploadStatus.COMPLETED,
          upload_completed_at: new Date(),
        });
        this.logger.log(`Image ${saved.id} uploaded for property ${referenceCode}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.propertyImageRepo.update(saved.id!, {
          upload_status: MediaUploadStatus.FAILED,
          error_message: errorMsg,
        });
        this.logger.error(`Image ${saved.id} upload failed: ${errorMsg}`);
      }
    });

    return {
      image_reference_id: saved.id!,
      upload_status: MediaUploadStatus.PENDING,
      informacion_adicional: 'Recordá utilizar este ID de referencia para eliminar o modificar esta imagen en el portal',
    };
  }

  // ================================================================
  // PATCH IMAGE (update metadata only, no file)
  // ================================================================

  async patchImage(
    referenceCode: string,
    imageId: number,
    dto: PartnerPatchImageDto,
    partner: Partner,
  ): Promise<{ image_reference_id: number; upload_status: string | undefined; error_message?: string | null; informacion_adicional: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const image = await this.propertyImageRepo.findOne({
      where: { id: imageId, property: { id: property.id } },
    });
    if (!image) {
      throw new NotFoundException(`Imagen ${imageId} no encontrada en propiedad ${referenceCode}`);
    }

    if (dto.is_blueprint !== undefined) image.is_blueprint = dto.is_blueprint;
    if (dto.description !== undefined) image.description = dto.description;
    if (dto.order_position !== undefined) image.order_position = dto.order_position;

    await this.propertyImageRepo.save(image);

    return {
      image_reference_id: image.id!,
      upload_status: image.upload_status,
      error_message: image.error_message,
      informacion_adicional: 'Recordá utilizar este ID de referencia para eliminar o modificar esta imagen en el portal',
    };
  }

  // ================================================================
  // REMOVE IMAGE
  // ================================================================

  async removeImage(
    referenceCode: string,
    imageId: number,
    partner: Partner,
  ): Promise<{ image_reference_id: number; message: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const image = await this.propertyImageRepo.findOne({
      where: { id: imageId, property: { id: property.id } },
    });

    if (!image) {
      throw new NotFoundException(`Imagen ${imageId} no encontrada en propiedad ${referenceCode}`);
    }

    await this.propertyImageRepo.remove(image);
    return { image_reference_id: imageId, message: `Imagen ${imageId} eliminada correctamente` };
  }

  // ================================================================
  // UPLOAD ATTACHED (multipart file → S3, fire-and-forget)
  // ================================================================

  async uploadAttached(
    referenceCode: string,
    file: Express.Multer.File,
    description: string | undefined,
    order: number | undefined,
    partner: Partner,
  ): Promise<{ attached_reference_id: number; upload_status: string; informacion_adicional: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const attRecord = this.propertyAttachedRepo.create({
      file_url: '',
      description,
      order,
      property: { id: property.id } as Property,
      upload_status: MediaUploadStatus.PENDING,
      retry_count: 0,
    });
    const saved = await this.propertyAttachedRepo.save(attRecord);

    const fileBuffer = file.buffer;
    const mimeType = file.mimetype;
    const ext = (file.originalname.split('.').pop() || 'pdf').toLowerCase();
    const s3Key = this.mediaService.buildS3Key(`properties/${property.id}/attached`, `${Date.now()}-${saved.id}.${ext}`);
    const url = this.mediaService.buildPublicUrl(s3Key);

    setImmediate(async () => {
      try {
        await this.mediaService.uploadFile(fileBuffer, s3Key, mimeType);
        await this.propertyAttachedRepo.update(saved.id!, {
          file_url: url,
          upload_status: MediaUploadStatus.COMPLETED,
          upload_completed_at: new Date(),
        });
        this.logger.log(`Attached ${saved.id} uploaded for property ${referenceCode}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.propertyAttachedRepo.update(saved.id!, {
          upload_status: MediaUploadStatus.FAILED,
          error_message: errorMsg,
        });
        this.logger.error(`Attached ${saved.id} upload failed: ${errorMsg}`);
      }
    });

    return {
      attached_reference_id: saved.id!,
      upload_status: MediaUploadStatus.PENDING,
      informacion_adicional: 'Recordá utilizar este ID de referencia para eliminar o modificar este adjunto en el portal',
    };
  }

  // ================================================================
  // PATCH ATTACHED (update metadata only)
  // ================================================================

  async patchAttached(
    referenceCode: string,
    attachedId: number,
    dto: PartnerPatchAttachedDto,
    partner: Partner,
  ): Promise<{ attached_reference_id: number; upload_status: string | undefined; error_message?: string | null; informacion_adicional: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const att = await this.propertyAttachedRepo.findOne({
      where: { id: attachedId, property: { id: property.id } },
    });
    if (!att) {
      throw new NotFoundException(`Adjunto ${attachedId} no encontrado en propiedad ${referenceCode}`);
    }

    if (dto.description !== undefined) att.description = dto.description;
    if (dto.order !== undefined) att.order = dto.order;

    await this.propertyAttachedRepo.save(att);

    return {
      attached_reference_id: att.id!,
      upload_status: att.upload_status,
      error_message: att.error_message,
      informacion_adicional: 'Recordá utilizar este ID de referencia para eliminar o modificar este adjunto en el portal',
    };
  }

  // ================================================================
  // REMOVE ATTACHED
  // ================================================================

  async removeAttached(
    referenceCode: string,
    attachedId: number,
    partner: Partner,
  ): Promise<{ attached_reference_id: number; message: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const att = await this.propertyAttachedRepo.findOne({
      where: { id: attachedId, property: { id: property.id } },
    });

    if (!att) {
      throw new NotFoundException(`Adjunto ${attachedId} no encontrado en propiedad ${referenceCode}`);
    }

    await this.propertyAttachedRepo.remove(att);
    return { attached_reference_id: attachedId, message: `Adjunto ${attachedId} eliminado correctamente` };
  }

  // ================================================================
  // GET PROPERTY
  // ================================================================

  async getProperty(
    referenceCode: string,
    partner: Partner,
  ): Promise<{ data: Property }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    const result = await this.propertiesService.findOne(property.id!);
    return { data: result };
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
   * Creates a new property via the shared PropertyWriteService core.
   */
  private async createPropertyInternal(
    dto: PartnerCreatePropertyDto,
    organizationId: number,
    branchId: number,
    userId?: number,
    extraWarnings: string[] = [],
  ): Promise<{ data: Property; created: boolean; warnings?: string[] }> {
    const { branch_reference_id, tags, videos, multimedia360, agent_email, agent_name, ...propertyScalars } = dto;

    const { property: savedProperty, warnings } = await this.propertyWriteService.createPropertyCore(
      { ...propertyScalars, deleted: false },
      { organizationId, branchId, userId, tags, videos, multimedia360 },
    );

    const result = await this.propertiesService.findOne(savedProperty.id!);
    const allWarnings = [...extraWarnings, ...warnings];
    return {
      data: result,
      created: true,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  /**
   * Updates an existing property via the shared PropertyWriteService core.
   */
  private async updatePropertyInternal(
    property: Property,
    dto: Partial<PartnerUpdatePropertyDto> & { tags?: number[] },
    organizationId?: number,
    branchId?: number,
    userId?: number,
  ): Promise<{ warnings: string[] }> {
    const { tags, ...scalarFields } = dto;
    return this.propertyWriteService.updatePropertyCore(property, scalarFields, {
      organizationId,
      branchId,
      userId,
      tags,
    });
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
    adminUserId: number | undefined,
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
        is_verified: false,
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
