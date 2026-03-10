import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaService } from '../../common/media/media.service';
import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

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

  create(data: Partial<Branch>) {
    const branch = this.repo.create(data);
    return this.repo.save(branch);
  }

  async update(id: number, data: Partial<Branch>) {
    const branch = await this.findOne(id);
    Object.assign(branch, data);
    return this.repo.save(branch);
  }

  async remove(id: number) {
    const branch = await this.findOne(id);
    return this.repo.remove(branch);
  }
}