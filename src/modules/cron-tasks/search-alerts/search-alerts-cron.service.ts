import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAlert, SearchAlertStatus } from '../../search-alerts/entities/search-alert.entity';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../../common/email/email.service';
import { PropertiesService } from '../../properties/properties.service';
import { SearchPropertiesDto } from '../../properties/dto/search-properties.dto';

/** Cantidad mínima de días entre envíos de email para la misma alerta */
const ALERTS_FREQUENCY_DAYS = 1;

/** Máxima cantidad de propiedades a incluir por email de alerta */
const ALERT_PROPERTIES_LIMIT = 5;

@Injectable()
export class SearchAlertsCronService {
  private readonly logger = new Logger(SearchAlertsCronService.name);

  constructor(
    @InjectRepository(SearchAlert)
    private readonly searchAlertRepo: Repository<SearchAlert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly propertiesService: PropertiesService,
  ) {}

  /** Corre todos los días a las 9:00 AM */
  @Cron('0 9 * * *')
  async handleSearchAlerts(): Promise<void> {
    this.logger.log('[SearchAlertsCron] Iniciando procesamiento de alertas de búsqueda...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ALERTS_FREQUENCY_DAYS);

    // Traer alertas activas cuyo last_email_sent es null o anterior al cutoff
    const alerts = await this.searchAlertRepo
      .createQueryBuilder('alert')
      .where('alert.status = :status', { status: SearchAlertStatus.ACTIVE })
      .andWhere(
        '(alert.last_email_sent IS NULL OR alert.last_email_sent <= :cutoff)',
        { cutoff: cutoffDate },
      )
      .getMany();

    this.logger.log(`[SearchAlertsCron] Alertas a procesar: ${alerts.length}`);

    for (const alert of alerts) {
      try {
        await this.processAlert(alert);
      } catch (err) {
        this.logger.error(
          `[SearchAlertsCron] Error procesando alerta #${alert.id}:`,
          err,
        );
      }
    }

    this.logger.log('[SearchAlertsCron] Procesamiento finalizado.');
  }

  private async processAlert(alert: SearchAlert): Promise<void> {
    // Parsear los filtros guardados como JSON
    let parsedFilters: Partial<SearchPropertiesDto> = {};
    try {
      parsedFilters = JSON.parse(alert.filters);
    } catch {
      this.logger.warn(
        `[SearchAlertsCron] Alerta #${alert.id}: no se pudo parsear los filtros. Se omite.`,
      );
      return;
    }

    const sinceDate = alert.last_email_sent ?? new Date(0);

    // Reusar searchProperties con los filtros del usuario, ordenado por más reciente
    const searchDto = Object.assign(new SearchPropertiesDto(), {
      ...parsedFilters,
      limit: ALERT_PROPERTIES_LIMIT,
      page: 1,
      order_by: 'created_at:DESC',
    } as SearchPropertiesDto);

    const result = await this.propertiesService.searchProperties(searchDto);

    // Filtrar solo propiedades creadas después del último envío
    const rawProperties = result.data as any[];
    const newProperties = rawProperties.filter((p) => {
      if (!p.created_at) return true;
      return new Date(p.created_at) > sinceDate;
    });

    if (newProperties.length === 0) {
      this.logger.log(
        `[SearchAlertsCron] Alerta #${alert.id}: sin propiedades nuevas que coincidan. Se omite.`,
      );
      return;
    }

    // Obtener datos del usuario
    const user = await this.userRepo.findOne({ where: { id: alert.user_id } });
    if (!user) {
      this.logger.warn(
        `[SearchAlertsCron] Alerta #${alert.id}: usuario #${alert.user_id} no encontrado.`,
      );
      return;
    }

    // Armar payload para el email
    const emailProperties = newProperties.map((p) => ({
      id: p.id,
      publication_title: p.publication_title,
      street: p.street,
      number: p.number,
      operation_type: p.operation_type as number,
      price: Number(p.price),
      currency: p.currency,
      total_surface: p.total_surface ? Number(p.total_surface) : undefined,
      room_amount: p.room_amount ?? undefined,
      bathroom_amount: p.bathroom_amount ?? undefined,
      price_square_meter: p.price_square_meter
        ? Number(p.price_square_meter)
        : undefined,
      firstImageUrl: p.images?.[0]?.url ?? null,
    }));

    await this.emailService.sendSearchAlertEmail(
      user.email,
      user.name,
      alert.title,
      emailProperties,
    );

    // Actualizar last_email_sent
    alert.last_email_sent = new Date();
    await this.searchAlertRepo.save(alert);

    this.logger.log(
      `[SearchAlertsCron] Alerta #${alert.id} — email enviado a ${user.email} con ${emailProperties.length} propiedad(es).`,
    );
  }
}

