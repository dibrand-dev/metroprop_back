import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaService } from '../../common/media/media.service';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectRepository(Branch)
    private repo: Repository<Branch>,
    private readonly mediaService: MediaService,
  ) {}

  findAll() {
    return this.repo.find({ relations: ['organization'] });
  }

  async findOne(id: number) {
    const branch = await this.repo.findOne({ where: { id }, relations: ['organization'] });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async findByExternalReference(organizationId: number, externalRef: string): Promise<Branch | null> {
    return this.repo.findOne({
      where: {
        external_reference: externalRef,
        organization: { id: organizationId },
        deleted: false,
      } as any,
      relations: ['organization'],
    });
  }

  async create(
    data: CreateBranchDto | (Partial<Branch> & { organizationId?: number }),
    file?: Express.Multer.File,
  ): Promise<Branch> {
    const { organizationId, ...rest } = data as any;
    const branch = this.repo.create(rest as Partial<Branch>);
    if (organizationId) {
      (branch as any).organization = { id: organizationId };
    }

    const createdBranch = await this.repo.save(branch);

    if (file) {
      await this.uploadLogoToS3(file, createdBranch.id);
      return this.findOne(createdBranch.id);
    }

    return createdBranch;
  }

  async update(
    id: number,
    data: UpdateBranchDto | (Partial<Branch> & { organizationId?: number }),
    file?: Express.Multer.File,
  ): Promise<Branch> {
    const branch = await this.findOne(id);
    const { organizationId, ...rest } = data as any;
    Object.assign(branch, rest);
    if (organizationId !== undefined) {
      (branch as any).organization = organizationId ? { id: organizationId } : null;
    }
    const updatedBranch = await this.repo.save(branch as Branch);

    if (file) {
      await this.uploadLogoToS3(file, id);
      return this.findOne(id);
    }

    return updatedBranch;
  }

  async remove(id: number) {
    const branch = await this.findOne(id);
    return this.repo.remove(branch);
  }

  async getByOrganization(organizationId: number) {
    return this.repo.find({
      where: {
        organization: { id: organizationId },
        deleted: false,
      } as any,
      relations: ['organization'],
    });
  }

  async uploadLogoToS3(file: Express.Multer.File, branchId: number): Promise<string | null> {
    const result = await this.mediaService.uploadEntityImage(file, {
      repository: this.repo,
      entityId: branchId,
      imageFieldName: 'branch_logo',
      statusFieldName: 'logo_status',
      s3Folder: BRANCH_IMAGE_FOLDER,
    });
    return result.url;
  }
}