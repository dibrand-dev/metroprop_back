import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { MediaService } from '../../common/media/media.service';
import { BRANCH_IMAGE_FOLDER } from '../../common/constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import axios from 'axios';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

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

  create(data: CreateBranchDto | (Partial<Branch> & { organizationId?: number })): Promise<Branch> {
    const { organizationId, ...rest } = data as any;
    const branch = this.repo.create(rest as Partial<Branch>);
    if (organizationId) {
      (branch as any).organization = { id: organizationId };
    }
    
    const savedBranchPromise = this.repo.save(branch);
    
    // Si hay logo URL, procesarlo automáticamente (fire and forget)
    if ((data as any).branch_logo && this.isValidUrl((data as any).branch_logo)) {
      savedBranchPromise.then(savedBranch => {
        this.processLogoFromUrl(savedBranch.id, (data as any).branch_logo!);
      }).catch(err => {
        this.logger.error(`Error saving branch: ${err.message}`);
      });
    }
    
    return savedBranchPromise;
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
  
  /**
   * Procesa un logo desde URL de forma asíncrona (fire and forget)
   * Descarga la imagen, la sube a S3 y actualiza el campo branch_logo
   */
  public processLogoFromUrl(branchId: number, logoUrl: string): void {
    setImmediate(async () => {
      try {
        this.logger.log(`Processing logo from URL for branch ${branchId}: ${logoUrl}`);
        
        // Descargar imagen desde URL
        const response = await axios.get(logoUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000, // 30 segundos timeout
          maxContentLength: 10 * 1024 * 1024, // 10MB máximo
        });
        
        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // Validar que sea una imagen
        if (!contentType.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }
        
        // Crear archivo simulado para MediaService
        const fakeFile = {
          buffer,
          mimetype: contentType,
          originalname: `logo.${contentType.split('/')[1] || 'jpg'}`,
        } as Express.Multer.File;
        
        // Subir a S3 usando el método existente
        const result = await this.mediaService.uploadEntityImage(fakeFile, {
          repository: this.repo,
          entityId: branchId,
          imageFieldName: 'branch_logo',
          statusFieldName: 'logo_status',
          s3Folder: BRANCH_IMAGE_FOLDER,
        });
        
        if (result.url) {
          this.logger.log(`Logo uploaded successfully for branch ${branchId}: ${result.url}`);
        } else {
          this.logger.error(`Failed to upload logo for branch ${branchId}`);
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error processing logo for branch ${branchId}: ${errorMsg}`);
        
        // Actualizar el campo logo_status con el error
        try {
          await this.repo.update(branchId, {
            logo_status: `Error downloading/uploading logo: ${errorMsg}`
          });
        } catch (updateError) {
          this.logger.error(`Failed to update logo_status for branch ${branchId}`);
        }
      }
    });
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
}