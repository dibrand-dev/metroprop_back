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
import { RegistrationService } from '../registration/registration.service';

import { CreateOrganizationRegistrationDto } from '../registration/dto/create-organization-registration.dto';
import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerPatchImageDto } from './dto/partner-patch-image.dto';
import { PartnerPatchAttachedDto } from './dto/partner-patch-attached.dto';

import { MediaUploadStatus, UserRole } from '../../common/enums';

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
    private readonly registrationService: RegistrationService,
    private readonly dataSource: DataSource,
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

    this.scheduleImageUpload(saved.id!, property.id!, file, referenceCode);

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
    file?: Express.Multer.File,
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

    if (file) {
      image.upload_status = MediaUploadStatus.PENDING;
      image.error_message = null;
    }

    await this.propertyImageRepo.save(image);

    if (file) {
      this.scheduleImageUpload(image.id!, property.id!, file, referenceCode);
    }

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

    this.scheduleAttachedUpload(saved.id!, property.id!, file, referenceCode);

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
    file?: Express.Multer.File,
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

    if (file) {
      att.upload_status = MediaUploadStatus.PENDING;
      att.error_message = null;
    }

    await this.propertyAttachedRepo.save(att);

    if (file) {
      this.scheduleAttachedUpload(att.id!, property.id!, file, referenceCode);
    }

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
   * Fire-and-forget: uploads a file to S3 and updates the image record on completion/failure.
   */
  private scheduleImageUpload(
    imageId: number,
    propertyId: number,
    file: Express.Multer.File,
    referenceCode: string,
  ): void {
    const { buffer, mimetype, originalname } = file;
    const ext = (originalname.split('.').pop() || 'jpg').toLowerCase();
    const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/images`, `${Date.now()}-${imageId}.${ext}`);

    setImmediate(async () => {
      try {
        await this.mediaService.uploadFile(buffer, s3Key, mimetype);
        await this.propertyImageRepo.update(imageId, {
          url: s3Key,
          upload_status: MediaUploadStatus.COMPLETED,
          upload_completed_at: new Date(),
        });
        this.logger.log(`Image ${imageId} uploaded for property ${referenceCode}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.propertyImageRepo.update(imageId, {
          upload_status: MediaUploadStatus.FAILED,
          error_message: errorMsg,
        });
        this.logger.error(`Image ${imageId} upload failed: ${errorMsg}`);
      }
    });
  }

  /**
   * Fire-and-forget: uploads a file to S3 and updates the attached record on completion/failure.
   */
  private scheduleAttachedUpload(
    attachedId: number,
    propertyId: number,
    file: Express.Multer.File,
    referenceCode: string,
  ): void {
    const { buffer, mimetype, originalname } = file;
    const ext = (originalname.split('.').pop() || 'pdf').toLowerCase();
    const s3Key = this.mediaService.buildS3Key(`properties/${propertyId}/attached`, `${Date.now()}-${attachedId}.${ext}`);

    setImmediate(async () => {
      try {
        await this.mediaService.uploadFile(buffer, s3Key, mimetype);
        await this.propertyAttachedRepo.update(attachedId, {
          file_url: s3Key,
          upload_status: MediaUploadStatus.COMPLETED,
          upload_completed_at: new Date(),
        });
        this.logger.log(`Attached ${attachedId} uploaded for property ${referenceCode}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.propertyAttachedRepo.update(attachedId, {
          upload_status: MediaUploadStatus.FAILED,
          error_message: errorMsg,
        });
        this.logger.error(`Attached ${attachedId} upload failed: ${errorMsg}`);
      }
    });
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

  /**
   * Reintentar uploads fallidos para una propiedad del partner
   */
  async retryFailedUploadsForPartner(
    referenceCode: string,
    partner: Partner,
  ) {
    // Primero validar que la propiedad pertenece al partner
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    
    if (!property.id) {
      throw new BadRequestException(`Propiedad ${referenceCode} no tiene un ID válido`);
    }
    
    // Usar el service de properties para hacer el retry
    const result = await this.propertiesService.retryFailedUploads(property.id);
    
    return {
      success: true,
      data: {
        property_reference: referenceCode,
        property_id: property.id,
        retry_results: result
      }
    };
  }

}
