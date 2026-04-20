import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdsBanner } from './entities/ads-banner.entity';
import { CreateAdsBannerDto } from './dto/create-ads-banner.dto';
import { UpdateAdsBannerDto } from './dto/update-ads-banner.dto';
import { MediaService } from '../../common/media/media.service';

@Injectable()
export class AdsBannersService {
  constructor(
    @InjectRepository(AdsBanner)
    private readonly repo: Repository<AdsBanner>,
    private readonly mediaService: MediaService,
  ) {}

  findAll(): Promise<AdsBanner[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<AdsBanner> {
    const banner = await this.repo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async create(
    dto: CreateAdsBannerDto,
    file?: Express.Multer.File,
  ): Promise<AdsBanner> {
    if (!file) {
      throw new BadRequestException('A banner image file is required');
    }

    const banner = this.repo.create({
      name: dto.name,
      placements: JSON.stringify(dto.placements),
      status: dto.status ?? true,
    });

    // Save first to get the id
    const saved = await this.repo.save(banner);

    // Upload to S3
    try {
      const ext = file.originalname.split('.').pop() || 'jpg';
      const key = this.mediaService.buildS3Key(
        'ads-banners',
        `${saved.id}-${Date.now()}.${ext}`,
      );
      await this.mediaService.uploadFile(file.buffer, key, file.mimetype);
      saved.file = key;
      saved.file_status = null as any;
      return this.repo.save(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      saved.file_status = msg.substring(0, 500);
      saved.file_retry = 1;
      await this.repo.save(saved);
      throw new BadRequestException(`File upload failed: ${msg}`);
    }
  }

  async update(
    id: number,
    dto: UpdateAdsBannerDto,
    file?: Express.Multer.File,
  ): Promise<AdsBanner> {
    const banner = await this.findOne(id);

    if (dto.name !== undefined) {
      banner.name = dto.name;
    }
    if (dto.placements) {
      banner.placements = JSON.stringify(dto.placements);
    }
    if (dto.status !== undefined) {
      banner.status = dto.status;
    }

    // If a new file was uploaded, replace in S3
    if (file) {
      try {
        const ext = file.originalname.split('.').pop() || 'jpg';
        const key = this.mediaService.buildS3Key(
          'ads-banners',
          `${banner.id}-${Date.now()}.${ext}`,
        );
        await this.mediaService.uploadFile(file.buffer, key, file.mimetype);
        banner.file = key;
        banner.file_status = null as any;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        banner.file_status = msg.substring(0, 500);
        banner.file_retry += 1;
      }
    }

    return this.repo.save(banner);
  }

  async disable(id: number): Promise<AdsBanner> {
    const banner = await this.findOne(id);
    banner.status = false;
    return this.repo.save(banner);
  }

  async remove(id: number): Promise<{ message: string }> {
    const banner = await this.findOne(id);
    await this.repo.remove(banner);
    return { message: 'Banner deleted successfully' };
  }
}
