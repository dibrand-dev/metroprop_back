import { S3Service } from '../../common/s3.service';
import { ORGANIZATION_IMAGE_FOLDER } from '../../common/constants';
import { ImageUploadService } from '../../common/image-upload/image-upload.service';
import { ImageUploadConfig } from '../../common/image-upload/dto/image-upload-config.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {

  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
    private readonly s3Service: S3Service,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  findAll() {
    return this.repo.find({ where: { deleted: false } });
  }

  async findOne(id: number) {
    const org = await this.repo.findOne({ where: { id, deleted: false } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  create(data: CreateOrganizationDto): Promise<Organization> {
    const { adminUserId, ...rest } = data;
    const org = this.repo.create(rest as Partial<Organization>) as Organization;
    if (adminUserId) {
      (org as any).admin_user = { id: adminUserId };
    }
    return this.repo.save(org);
  }

  async update(id: number, data: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findOne(id);
    const { adminUserId, ...rest } = data;
    Object.assign(org, rest);
    if (adminUserId !== undefined) {
      (org as any).admin_user = adminUserId ? { id: adminUserId } : null;
    }
    return this.repo.save(org);
  }

  async remove(id: number) {
    const org = await this.findOne(id);
    org.deleted = true; // borrado lógico
    org.deleted_at = new Date();
    return this.repo.save(org);
  }

  /**
   * Sube un logo de organización a S3 usando el key relativo (ej: 147/logo.jpg)
   * El path final será organizations/147/logo.jpg
   */
  async uploadLogoToS3(file: Express.Multer.File, orgId: number): Promise<string | null> {
    const config: ImageUploadConfig<any> = {
      repository: this.repo,
      entityId: orgId,
      imageFieldName: 'company_logo',
      statusFieldName: 'logo_status',
      s3Folder: ORGANIZATION_IMAGE_FOLDER,
      primaryKeyField: 'id',
    };
    const result = await this.imageUploadService.uploadImage(file, config);
    return result.url;
  }
}