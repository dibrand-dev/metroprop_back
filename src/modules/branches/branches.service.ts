import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaService } from '../../common/media/media.service';
import { Branch } from './entities/branch.entity';
import { Property } from '../properties/entities/property.entity';
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
    return this.repo.find({ relations: ['organization'], where: { deleted: false }, order: { id: 'ASC' } });
  }

  async findOne(id: number) {
    const branch = await this.repo.findOne({ where: { id, deleted: false }, relations: ['organization'] });
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
    const shouldReassignProperties = (data as any)?.deleted === true;

    const updatedBranch = await this.repo.manager.transaction(async (manager) => {
      const branchRepo = manager.getRepository(Branch);
      const propertyRepo = manager.getRepository(Property);

      const branch = await branchRepo.findOne({ where: { id }, relations: ['organization'] });
      if (!branch) throw new NotFoundException('Branch not found');

      const { organizationId, ...rest } = data as any;
      Object.assign(branch, rest);
      if (organizationId !== undefined) {
        (branch as any).organization = organizationId ? { id: organizationId } : null;
      }

      const savedBranch = await branchRepo.save(branch as Branch);

      if (shouldReassignProperties) {
        const orgId = organizationId ?? branch.organization?.id;
        if (!orgId) {
          throw new BadRequestException('No se pudo determinar la organización para reasignar propiedades');
        }

        const replacementBranch = await branchRepo
          .createQueryBuilder('b')
          .leftJoin('b.organization', 'o')
          .where('o.id = :orgId', { orgId })
          .andWhere('b.deleted = :deleted', { deleted: false })
          .andWhere('b.id != :currentBranchId', { currentBranchId: id })
          .orderBy('b.id', 'ASC')
          .getOne();

        if (!replacementBranch) {
          throw new BadRequestException(
            'No existe otra sucursal activa en la organización para reasignar propiedades',
          );
        }

        const reassignment = await propertyRepo
          .createQueryBuilder()
          .update(Property)
          .set({ branch_id: replacementBranch.id })
          .where('branch_id = :currentBranchId', { currentBranchId: id })
          .execute();

        this.logger.log(
          `Branch ${id} marcado como deleted. Reasignadas ${reassignment.affected ?? 0} propiedades a branch ${replacementBranch.id}`,
        );
      }

      return savedBranch;
    });

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
   /* return this.repo.find({
      where: {
        organization: { id: organizationId },
      //  deleted: false,
      } as any,
      relations: ['organization'],
      order: {
        id: 'ASC',
      },
    }); */
    const qb = this.repo
    .createQueryBuilder('branch')
    .leftJoin('branch.organization', 'organization')
    .leftJoin('properties', 'property', 'property.branch_id = branch.id AND property.deleted = false')
    .leftJoin('users_branches', 'ub', 'ub.branch_id = branch.id')
    .leftJoin('users', 'user', 'user.id = ub.user_id AND user.deleted = false')
    .where('organization.id = :organizationId', { organizationId })
    .groupBy('branch.id')
    .addGroupBy('organization.id')
    .select([
      'branch.*',
      'organization.id AS organization_id',
      'COUNT(DISTINCT property.id) AS properties_count',
      'COUNT(DISTINCT user.id) AS users_count',
    ])
    .orderBy('branch.id', 'ASC');
    return qb.getRawMany();
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