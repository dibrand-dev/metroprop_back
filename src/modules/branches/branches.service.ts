import { Injectable, NotFoundException } from '@nestjs/common';
import { ImageUploadService } from '../../common/image-upload/image-upload.service';
import { ImageUploadConfig } from '../../common/image-upload/dto/image-upload-config.dto';
import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private repo: Repository<Branch>,
    private readonly imageUploadService: ImageUploadService,
  ) {}
  /**
   * Sube un logo de branch a S3 usando el servicio centralizado
   */
  async uploadLogoToS3(file: Express.Multer.File, branchId: number): Promise<string | null> {
    const config: ImageUploadConfig<any> = {
      repository: this.repo,
      entityId: branchId,
      imageFieldName: 'branch_logo',
      statusFieldName: 'logo_status',
      s3Folder: BRANCH_IMAGE_FOLDER,
      primaryKeyField: 'id',
    };
    const result = await this.imageUploadService.uploadImage(file, config);
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