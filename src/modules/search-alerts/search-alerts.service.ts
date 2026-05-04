import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAlert, SearchAlertStatus } from './entities/search-alert.entity';
import { CreateSearchAlertDto } from './dto/create-search-alert.dto';
import { UpdateSearchAlertDto } from './dto/update-search-alert.dto';

@Injectable()
export class SearchAlertsService {
  constructor(
    @InjectRepository(SearchAlert)
    private readonly searchAlertRepository: Repository<SearchAlert>,
  ) {}

  async create(userId: number, dto: CreateSearchAlertDto): Promise<SearchAlert> {
    const alert = this.searchAlertRepository.create({
      user_id: userId,
      title: dto.title,
      filters: dto.filters,
      status: SearchAlertStatus.ACTIVE,
    });
    return this.searchAlertRepository.save(alert);
  }

  async findAllByUser(userId: number): Promise<SearchAlert[]> {
    return this.searchAlertRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<SearchAlert> {
    const alert = await this.searchAlertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Alerta de búsqueda #${id} no encontrada`);
    }
    if (alert.user_id !== userId) {
      throw new ForbiddenException('No tenés permiso para acceder a esta alerta');
    }
    return alert;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateSearchAlertDto,
  ): Promise<SearchAlert> {
    const alert = await this.findOne(id, userId);
    Object.assign(alert, dto);
    return this.searchAlertRepository.save(alert);
  }

  async remove(id: number, userId: number): Promise<void> {
    const alert = await this.findOne(id, userId);
    await this.searchAlertRepository.remove(alert);
  }
}
