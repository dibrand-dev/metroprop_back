import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaService } from '../../common/media/media.service';
import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private repo: Repository<Branch>,
    private readonly mediaService: MediaService,
  ) {}
  /**
   * Sube un logo de branch a S3 usando el servicio centralizado
   */
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

  findAll() {
    return this.repo.find({ relations: ['organization'] });
  }

  async findOne(id: number) {
    const branch = await this.repo.findOne({ where: { id }, relations: ['organization'] });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  create(data: CreateBranchDto | (Partial<Branch> & { organizationId?: number })): Promise<Branch> {
    const { organizationId, ...rest } = data as any;
    const branch = this.repo.create(rest as Partial<Branch>);
    if (organizationId) {
      (branch as any).organization = { id: organizationId };
    }
    return this.repo.save(branch);
  }

  async update(id: number, data: UpdateBranchDto | (Partial<Branch> & { organizationId?: number })): Promise<Branch> {
    const branch = await this.findOne(id);
    const { organizationId, ...rest } = data as any;
    Object.assign(branch, rest);
    if (organizationId !== undefined) {
      (branch as any).organization = organizationId ? { id: organizationId } : null;
    }
    return this.repo.save(branch as Branch);
  }

  async remove(id: number) {
    const branch = await this.findOne(id);
    return this.repo.remove(branch);
  }
}