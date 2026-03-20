import { MediaService } from '../../common/media/media.service';
import { ORGANIZATION_IMAGE_FOLDER } from '../../common/constants';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationFiltersDto } from './dto/organization-filters.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
    private readonly mediaService: MediaService,
  ) {}

  async findAll(filters: OrganizationFiltersDto = {}) {
    const {
      id,
      limit = 20,
      offset = 0,
      deleted = false,
      source_partner_id,
      company_name,
      location_id,
      state_id
    } = filters;

    const whereConditions: any = {
      deleted
    };

    if (id !== undefined) {
      whereConditions.id = id;
    }

    if (source_partner_id !== undefined) {
      whereConditions.source_partner_id = source_partner_id;
    }

    if (company_name) {
      whereConditions.company_name = Like(`%${company_name}%`);
    }

    if (location_id) {
      whereConditions.location_id = location_id;
    }

    if (state_id !== undefined) {
      whereConditions.state_id = state_id;
    }

    const [data, total] = await this.repo.findAndCount({
      where: whereConditions,
      take: limit,
      skip: offset,
      order: {
        created_at: 'DESC'
      }
    });

    return {
      data,
      total
    };
  }

  /**
   * Deshabilitar una organización (status = false)
   */
  async disable(id: number) {
    const org = await this.findOne(id);
    org.status = false;
    return this.repo.save(org);
  }

  /**
   * Habilitar una organización (status = true)
   */
  async enable(id: number) {
    const org = await this.findOne(id);
    org.status = true;
    return this.repo.save(org);
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
    const result = await this.mediaService.uploadEntityImage(file, {
      repository: this.repo,
      entityId: orgId,
      imageFieldName: 'company_logo',
      statusFieldName: 'logo_status',
      s3Folder: ORGANIZATION_IMAGE_FOLDER,
    });
    return result.url;
  }

  /**
   * @deprecated Use the ImageUploadS3CronModule cron job instead.
   * The cron picks up any org with company_logo LIKE 'http%' every 5 minutes.
   */
  public processLogoFromUrl(_orgId: number, _logoUrl: string): void {
    // no-op: upload is now handled by ImageUploadS3CronModule
    this.logger.warn('[OrganizationsService] processLogoFromUrl called — upload delegated to cron');
  }

  /**
   * Valida si una cadena es una URL válida
   */
  private isValidUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Obtencion de organización con branches y usuarios
   * una sola query con relations
   * @param searchCriteria Criterios de búsqueda flexibles
   * @returns Información completa con mapas optimizados para búsqueda rápida
   */
  async getOrganizationWithRelations(searchCriteria: {
    id?: number;
    external_reference?: string;
    company_name?: string;
    tokko_key?: string;
  }): Promise<{
    organization?: Organization;
    branchesMap?: Map<string, any>;
    usersMap?: Map<string, any>;
    branches?: any[];
    users?: any[];
    error?: string;
  }> {
    try {

      // 1. Construir query dinámicamente según los criterios
      const queryBuilder = this.repo.createQueryBuilder('organization')
        .leftJoinAndSelect('organization.branches', 'branches')
        .leftJoinAndSelect('organization.users', 'users') 
        .where('organization.deleted = :deleted', { deleted: false });

      // Agregar condiciones de búsqueda
      if (searchCriteria.id) {
        queryBuilder.andWhere('organization.id = :id', { id: searchCriteria.id });
      } else if (searchCriteria.external_reference) {
        queryBuilder.andWhere('organization.external_reference = :external_reference', { 
          external_reference: searchCriteria.external_reference 
        });
      } else if (searchCriteria.company_name) {
        queryBuilder.andWhere('organization.company_name ILIKE :company_name', { 
          company_name: `%${searchCriteria.company_name}%` 
        });
      } else if (searchCriteria.tokko_key) {
        queryBuilder.andWhere('organization.tokko_key = :tokko_key', { 
          tokko_key: searchCriteria.tokko_key 
        });
      } else {
        return {
          error: 'At least one search criteria must be provided (id, external_reference, company_name, or tokko_key)'
        };
      }

      // 2. Ejecutar query optimizada con todas las relaciones
      const organization = await queryBuilder.getOne();
      
      if (!organization) {
        return {
          error: 'Organization not found with the provided criteria'
        };
      }

      // 3. Extraer branches y users de las relaciones cargadas
      const branches = organization.branches || [];
      const users = organization.users || [];

      
      return {
        organization,
        branches,
        users
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error pre-loading organization:', errorMessage);
      return {
        error: `Failed to preload organization: ${errorMessage}`
      };
    }
  }
}