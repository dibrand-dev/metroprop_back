import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';

import { Organization } from '../organizations/entities/organization.entity';
import { Branch } from '../branches/entities/branch.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { PropertyOperation } from '../properties/entities/property-operation.entity';
import { PropertyTag } from '../properties/entities/property-tag.entity';
import { PropertyVideo } from '../properties/entities/property-video.entity';
import { PropertyAttached } from '../properties/entities/property-attached.entity';
import { Partner } from './entities/partner.entity';

import { PropertiesService } from '../properties/properties.service';

import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerAddImagesDto } from './dto/partner-add-images.dto';
import { PartnerAddAttachedDto } from './dto/partner-add-attached.dto';

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
    @InjectRepository(PropertyOperation)
    private readonly propertyOperationRepo: Repository<PropertyOperation>,
    @InjectRepository(PropertyTag)
    private readonly propertyTagRepo: Repository<PropertyTag>,
    @InjectRepository(PropertyVideo)
    private readonly propertyVideoRepo: Repository<PropertyVideo>,
    @InjectRepository(PropertyAttached)
    private readonly propertyAttachedRepo: Repository<PropertyAttached>,
    private readonly propertiesService: PropertiesService,
    private readonly dataSource: DataSource,
  ) {}

  // ================================================================
  // CREATE / UPSERT PROPERTY
  // ================================================================

  async createOrUpsertProperty(
    dto: PartnerCreatePropertyDto,
    partner: Partner,
  ): Promise<{ data: Property; created: boolean; warnings?: string[] }> {
    // 1. Resolver o crear Organization + Branch + User
    const { organization, branch, user } = await this.resolveCompanyAndAdmin(
      dto.company,
      dto.administrator,
      partner,
    );

    // 2. Buscar propiedad existente por reference_code + organization_id (upsert)
    const existing = await this.propertyRepo.findOne({
      where: {
        reference_code: dto.reference_code,
        organization_id: organization.id,
        deleted: false,
      },
      relations: ['images', 'operations', 'tags', 'videos', 'attached'],
    });

    if (existing) {
      // UPDATE: excluir company/administrator, pasar resto como update
      const { company, administrator, operations, images, videos, multimedia360, attached, tags, ...scalarFields } = dto;
      const updateResult = await this.updatePropertyInternal(
        existing,
        { ...scalarFields, operations, tags },
        organization,
        branch,
        user,
      );

      // Si venían multimedia en el POST inicial, agregarlas
      const multimediaWarnings: string[] = [];
      if (images && images.length > 0) {
        await this.addImagesToProperty(existing.id!, images);
      }
      if (videos && videos.length > 0) {
        await this.syncVideos(existing.id!, videos, false);
      }
      if (multimedia360 && multimedia360.length > 0) {
        await this.syncMultimedia360(existing.id!, multimedia360, false);
      }
      if (attached && attached.length > 0) {
        await this.addAttachedToProperty(existing.id!, attached);
      }

      const result = await this.propertiesService.findOne(existing.id!);
      return {
        data: result,
        created: false,
        warnings: updateResult.warnings.length > 0 ? updateResult.warnings : undefined,
      };
    }

    // CREATE: nueva propiedad
    return this.createPropertyInternal(dto, organization, branch, user);
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

    const updateResult = await this.updatePropertyInternal(
      property,
      dto,
      undefined,
      undefined,
      undefined,
    );

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

    // PropertyStatus.NO_DISPONIBLE = 4
    property.status = 4 as any;
    await this.propertyRepo.save(property);

    const result = await this.propertiesService.findOne(property.id!);
    this.logger.log(`Property ${referenceCode} deactivated by partner ${partner.id}`);
    return { data: result };
  }

  // ================================================================
  // ADD IMAGES
  // ================================================================

  async addImages(
    referenceCode: string,
    dto: PartnerAddImagesDto,
    partner: Partner,
  ): Promise<{ data: any }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    await this.addImagesToProperty(property.id!, dto.images);

    const multimedia = await this.propertiesService.getMultimedia(property.id!);
    return { data: { images: multimedia.images } };
  }

  // ================================================================
  // REMOVE IMAGE
  // ================================================================

  async removeImage(
    referenceCode: string,
    imageId: number,
    partner: Partner,
  ): Promise<{ message: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const image = await this.propertyImageRepo.findOne({
      where: { id: imageId, property: { id: property.id } },
    });

    if (!image) {
      throw new NotFoundException(`Imagen ${imageId} no encontrada en propiedad ${referenceCode}`);
    }

    await this.propertyImageRepo.remove(image);
    return { message: `Imagen ${imageId} eliminada correctamente` };
  }

  // ================================================================
  // ADD ATTACHED
  // ================================================================

  async addAttached(
    referenceCode: string,
    dto: PartnerAddAttachedDto,
    partner: Partner,
  ): Promise<{ data: any }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);
    await this.addAttachedToProperty(property.id!, dto.attached);

    const multimedia = await this.propertiesService.getMultimedia(property.id!);
    return { data: { attached: multimedia.attached } };
  }

  // ================================================================
  // REMOVE ATTACHED
  // ================================================================

  async removeAttached(
    referenceCode: string,
    attachedId: number,
    partner: Partner,
  ): Promise<{ message: string }> {
    const property = await this.findPropertyByRefCode(referenceCode, partner);

    const att = await this.propertyAttachedRepo.findOne({
      where: { id: attachedId, property: { id: property.id } },
    });

    if (!att) {
      throw new NotFoundException(`Adjunto ${attachedId} no encontrado en propiedad ${referenceCode}`);
    }

    await this.propertyAttachedRepo.remove(att);
    return { message: `Adjunto ${attachedId} eliminado correctamente` };
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
   * Resuelve (find-or-create) Organization + Branch + User para un partner.
   * Usa external_reference del company DTO + source_partner_id para deduplicar.
   */
  private async resolveCompanyAndAdmin(
    companyDto: PartnerCreatePropertyDto['company'],
    adminDto: PartnerCreatePropertyDto['administrator'],
    partner: Partner,
  ): Promise<{ organization: Organization; branch: Branch; user: User }> {
    return this.dataSource.transaction(async (manager) => {
      // --- Organization ---
      let organization = await manager.findOne(Organization, {
        where: {
          source_partner_id: partner.id,
          external_reference: companyDto.reference_id,
          deleted: false,
        },
      });

      if (!organization) {
        organization = manager.create(Organization, {
          company_name: companyDto.company_name,
          email: companyDto.email,
          phone: companyDto.phone,
          alternative_phone: companyDto.alternative_phone,
          address: companyDto.address,
          contact_time: companyDto.contact_time,
          cuit: companyDto.cuit || undefined,
          fiscal_condition: companyDto.fiscal_condition,
          social_reason: companyDto.social_reason,
          professional_type: companyDto.professional_type,
          location_id: companyDto.location_id?.toString(),
          full_location: companyDto.full_location,
          geo_lat: companyDto.geo_lat?.toString(),
          geo_long: companyDto.geo_long?.toString(),
          external_reference: companyDto.reference_id,
          source_partner_id: partner.id,
          deleted: false,
        });
        organization = await manager.save(Organization, organization);
        this.logger.log(
          `Created organization ${organization.id} (ext_ref=${companyDto.reference_id}) for partner ${partner.id}`,
        );
      } else {
        // Update org fields if they changed
        let changed = false;
        const updates: Partial<Organization> = {};
        if (companyDto.company_name && companyDto.company_name !== organization.company_name) {
          updates.company_name = companyDto.company_name; changed = true;
        }
        if (companyDto.email && companyDto.email !== organization.email) {
          updates.email = companyDto.email; changed = true;
        }
        if (companyDto.phone !== undefined && companyDto.phone !== organization.phone) {
          updates.phone = companyDto.phone; changed = true;
        }
        if (changed) {
          await manager.update(Organization, organization.id, updates);
          Object.assign(organization, updates);
        }
      }

      // --- Branch (one default branch per org) ---
      let branch = await manager.findOne(Branch, {
        where: { organization: { id: organization.id } },
      });

      if (!branch) {
        branch = manager.create(Branch, {
          branch_name: companyDto.company_name,
          email: companyDto.email,
          phone: companyDto.phone,
          organization,
        });
        branch = await manager.save(Branch, branch);
        this.logger.log(`Created branch ${branch.id} for organization ${organization.id}`);
      }

      // --- User (admin) ---
      let user = await manager.findOne(User, {
        where: { email: adminDto.email },
      });

      if (!user) {
        // Generate a random password — the partner user doesn't login via password
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = manager.create(User, {
          name: adminDto.name,
          email: adminDto.email,
          password: hashedPassword,
          phone: adminDto.phone,
          organization: { id: organization.id } as Organization,
          is_verified: true,
        });
        user = await manager.save(User, user);

        // Link user to branch
        await manager
          .createQueryBuilder()
          .relation(User, 'branches')
          .of(user)
          .add(branch.id);

        // Set as org admin
        await manager.update(Organization, organization.id, {
          admin_user: { id: user.id } as User,
        });

        this.logger.log(`Created admin user ${user.id} (${adminDto.email}) for organization ${organization.id}`);
      }

      return { organization, branch, user };
    });
  }

  /**
   * Creates a new property and its relations.
   */
  private async createPropertyInternal(
    dto: PartnerCreatePropertyDto,
    organization: Organization,
    branch: Branch,
    user: User,
  ): Promise<{ data: Property; created: boolean; warnings?: string[] }> {
    const {
      company,
      administrator,
      images,
      tags,
      operations,
      videos,
      multimedia360,
      attached,
      ...propertyScalars
    } = dto;
    const warnings: string[] = [];

    // Fill denormalized operation fields from first operation
    const firstOp = operations[0];

    const newProperty = this.propertyRepo.create({
      ...propertyScalars,
      operation_type: firstOp.operation_type as any,
      price: firstOp.price,
      currency: firstOp.currency as any,
      organization_id: organization.id,
      branch_id: branch.id,
      user_id: user.id,
      deleted: false,
    } as any);

    const savedProperty = await this.propertyRepo.save(newProperty) as unknown as Property;
    const propertyId = savedProperty.id!;

    // Operations
    for (const op of operations) {
      const propOp = this.propertyOperationRepo.create({
        ...op,
        property: { id: propertyId } as Property,
      });
      await this.propertyOperationRepo.save(propOp);
    }

    // Tags
    if (tags && tags.length > 0) {
      const tagWarnings = await this.syncTags(propertyId, tags, { id: propertyId } as Property);
      warnings.push(...tagWarnings);
    }

    // Images (fire-and-forget background)
    if (images && images.length > 0) {
      await this.addImagesToProperty(propertyId, images);
    }

    // Videos
    if (videos && videos.length > 0) {
      await this.syncVideos(propertyId, videos, false);
    }

    // Multimedia 360
    if (multimedia360 && multimedia360.length > 0) {
      await this.syncMultimedia360(propertyId, multimedia360, false);
    }

    // Attached (fire-and-forget)
    if (attached && attached.length > 0) {
      await this.addAttachedToProperty(propertyId, attached);
    }

    const result = await this.propertiesService.findOne(propertyId);
    return {
      data: result,
      created: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Updates an existing property's scalar fields, operations, and tags.
   */
  private async updatePropertyInternal(
    property: Property,
    dto: Partial<PartnerUpdatePropertyDto> & { operations?: any[]; tags?: number[] },
    organization?: Organization,
    branch?: Branch,
    user?: User,
  ): Promise<{ warnings: string[] }> {
    const { operations, tags, ...scalarFields } = dto;
    const warnings: string[] = [];

    // Scalar fields
    const updateData: any = { ...scalarFields };
    if (organization) updateData.organization_id = organization.id;
    if (branch) updateData.branch_id = branch.id;
    if (user) updateData.user_id = user.id;

    // Update denormalized fields from first operation if operations provided
    if (operations && operations.length > 0) {
      const firstOp = operations[0];
      updateData.operation_type = firstOp.operation_type;
      updateData.price = firstOp.price;
      updateData.currency = firstOp.currency;
    }

    Object.assign(property, updateData);
    await this.propertyRepo.save(property);

    // Replace operations if provided
    if (operations && operations.length > 0) {
      await this.propertyOperationRepo.delete({ property: { id: property.id } });
      for (const op of operations) {
        const propOp = this.propertyOperationRepo.create({
          ...op,
          property: { id: property.id } as Property,
        });
        await this.propertyOperationRepo.save(propOp);
      }
    }

    // Replace tags if provided
    if (tags !== undefined) {
      await this.propertyTagRepo.delete({ property: { id: property.id } });
      if (tags.length > 0) {
        const tagWarnings = await this.syncTags(property.id!, tags, property);
        warnings.push(...tagWarnings);
      }
    }

    return { warnings };
  }

  /**
   * Find property by reference_code scoped to the partner's organizations.
   */
  private async findPropertyByRefCode(
    referenceCode: string,
    partner: Partner,
  ): Promise<Property> {
    // Get all organization IDs belonging to this partner
    const orgIds = await this.organizationRepo
      .createQueryBuilder('org')
      .select('org.id')
      .where('org.source_partner_id = :partnerId', { partnerId: partner.id })
      .andWhere('org.deleted = false')
      .getMany();

    if (orgIds.length === 0) {
      throw new NotFoundException(
        `No se encontraron organizaciones para este partner`,
      );
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
   * Validate and insert tags, returning warnings for invalid ones.
   */
  private async syncTags(
    propertyId: number,
    tagIds: number[],
    property: Property,
  ): Promise<string[]> {
    const warnings: string[] = [];
    const existingTags = await this.dataSource.query(
      `SELECT id FROM tags WHERE id = ANY($1)`,
      [tagIds],
    );
    const existingIds = new Set(existingTags.map((t: { id: number }) => t.id));
    const validIds = tagIds.filter((id) => existingIds.has(id));
    const invalidIds = tagIds.filter((id) => !existingIds.has(id));

    if (validIds.length > 0) {
      const newTags = validIds.map((tagId) =>
        this.propertyTagRepo.create({
          tag_id: tagId,
          property: { id: propertyId } as Property,
        }),
      );
      await this.propertyTagRepo.save(newTags);
    }

    if (invalidIds.length > 0) {
      warnings.push(`Tag IDs no válidos e ignorados: ${invalidIds.join(', ')}`);
    }
    return warnings;
  }

  /**
   * Add images to a property (PENDING status, delegated to PropertiesService background processing).
   */
  private async addImagesToProperty(
    propertyId: number,
    images: Array<{ url: string; is_blueprint?: boolean; description?: string; order_position?: number }>,
  ): Promise<void> {
    const imagesToProcess: { imageId: number; originalUrl: string; propertyId: number }[] = [];

    for (const img of images) {
      const propertyImage = this.propertyImageRepo.create({
        url: img.url ?? '',
        is_blueprint: img.is_blueprint ?? false,
        description: img.description,
        order_position: img.order_position,
        property: { id: propertyId } as Property,
        upload_status: MediaUploadStatus.PENDING,
        retry_count: 0,
      });
      const saved = await this.propertyImageRepo.save(propertyImage);

      imagesToProcess.push({
        imageId: saved.id!,
        originalUrl: img.url,
        propertyId,
      });
    }

    // Delegate background processing to PropertiesService (fire-and-forget)
    if (imagesToProcess.length > 0) {
      (this.propertiesService as any).processAndUploadImages(imagesToProcess);
    }
  }

  /**
   * Add attached files to a property (PENDING, fire-and-forget).
   */
  private async addAttachedToProperty(
    propertyId: number,
    attachedItems: Array<{ file_url: string; description?: string; order?: number }>,
  ): Promise<void> {
    for (const att of attachedItems) {
      const entity = this.propertyAttachedRepo.create({
        file_url: att.file_url,
        description: att.description,
        order: att.order,
        property: { id: propertyId } as Property,
        upload_status: MediaUploadStatus.PENDING,
        retry_count: 0,
      });
      const saved = await this.propertyAttachedRepo.save(entity);

      if (att.file_url && att.file_url.startsWith('http') && saved.id) {
        setImmediate(() => {
          (this.propertiesService as any)._processAndUploadAttached(
            saved.id!,
            propertyId,
            { originalUrl: att.file_url },
          );
        });
      }
    }
  }

  /**
   * Sync videos (non-360) for a property.
   */
  private async syncVideos(
    propertyId: number,
    videos: Array<{ url: string; provider?: string; title?: string; order?: number }>,
    isUpdate: boolean,
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({
        property: { id: propertyId },
        is_360: false,
      });
    }

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const entity = this.propertyVideoRepo.create({
        url: v.url,
        property: { id: propertyId } as Property,
        is_360: false,
        order: v.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }

  /**
   * Sync multimedia 360 for a property.
   */
  private async syncMultimedia360(
    propertyId: number,
    items: Array<{ url: string; order?: number }>,
    isUpdate: boolean,
  ): Promise<void> {
    if (isUpdate) {
      await this.propertyVideoRepo.delete({
        property: { id: propertyId },
        is_360: true,
      });
    }

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const entity = this.propertyVideoRepo.create({
        url: m.url,
        property: { id: propertyId } as Property,
        is_360: true,
        order: m.order ?? i + 1,
      });
      await this.propertyVideoRepo.save(entity);
    }
  }
}
