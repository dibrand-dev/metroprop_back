import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PARTNER_IMAGE_FOLDER } from '../../common/constants';
import { MediaService } from '../../common/media/media.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from './entities/partner.entity';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnersRepository: Repository<Partner>,
    private readonly mediaService: MediaService,
  ) {}
  /**
   * Sube una imagen de partner a S3 usando el servicio centralizado
   */
  async uploadImageToS3(file: Express.Multer.File, partnerId: number): Promise<string | null> {
    const result = await this.mediaService.uploadEntityImage(file, {
      repository: this.partnersRepository,
      entityId: partnerId,
      imageFieldName: 'image',
      statusFieldName: 'image_status',
      s3Folder: PARTNER_IMAGE_FOLDER,
    });
    return result.url;
  }

  async create(createPartnerDto: CreatePartnerDto): Promise<Partner> {
    const existingPartner = await this.partnersRepository.findOne({
      where: { app_key: createPartnerDto.app_key },
    });

    if (existingPartner) {
      throw new ConflictException('Partner with this App Key already exists');
    }

    const partner = this.partnersRepository.create(createPartnerDto);
    return await this.partnersRepository.save(partner);
  }

  async findAll(limit: number = 10, offset: number = 0) {
    const [partners, total] = await this.partnersRepository.findAndCount({
      skip: offset,
      take: limit,
      where: { deleted: false },
      select: [
        'id',
        'name',
        'description',
        'app_key',
        'status',
        'created_at',
        'updated_at',
      ],
      order: { created_at: 'DESC' },
    });

    return { partners, total };
  }

  async findById(id: number): Promise<Partner> {
    const partner = await this.partnersRepository.findOne({
      where: { id, deleted: false },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner;
  }

  async findByAppKey(app_key: string): Promise<Partner | null> {
    return this.partnersRepository.findOne({
      where: { app_key, deleted: false },
    });
  }

  async update(id: number, updatePartnerDto: UpdatePartnerDto): Promise<Partner> {
    const partner = await this.findById(id);

    // Check if app_key is being updated and if it already exists
    if (
      updatePartnerDto.app_key &&
      updatePartnerDto.app_key !== partner.app_key
    ) {
      const existingPartner = await this.partnersRepository.findOne({
        where: { app_key: updatePartnerDto.app_key },
      });

      if (existingPartner) {
        throw new ConflictException(
          'Partner with this App Key already exists',
        );
      }
    }

    Object.assign(partner, updatePartnerDto);
    return await this.partnersRepository.save(partner);
  }

  async remove(id: number): Promise<void> {
    const partner = await this.findById(id);
    partner.deleted = true;
    await this.partnersRepository.save(partner);
  }

  async hardDelete(id: number): Promise<void> {
    const partner = await this.findById(id);
    await this.partnersRepository.remove(partner);
  }
}
