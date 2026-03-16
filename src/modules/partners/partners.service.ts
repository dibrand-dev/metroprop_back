import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from './entities/partner.entity';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    @InjectRepository(Partner)
    private partnersRepository: Repository<Partner>,
  ) {}

  async create(createPartnerDto: CreatePartnerDto): Promise<Partner> {
    // Generar app_key y app_secret si no se proporcionaron
    const accessKeys = await this.generateAccessKeys();
    
    const partnerData = {
      ...createPartnerDto,
      app_key: createPartnerDto.app_key || accessKeys.app_key,
      app_secret: createPartnerDto.app_secret || accessKeys.app_secret,
    };

    // Verificar si ya existe un partner con este app_key
    const existingPartner = await this.partnersRepository.findOne({
      where: { app_key: partnerData.app_key },
    });

    if (existingPartner) {
      throw new ConflictException('Partner with this App Key already exists');
    }

    const partner = this.partnersRepository.create(partnerData);
    const savedPartner = await this.partnersRepository.save(partner);
    
    this.logger.log(`Created partner ${savedPartner.id} with app_key: ${savedPartner.app_key.substring(0, 8)}...`);
    
    return savedPartner;
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

  async findByName(name: string): Promise<Partner | null> {
    const partner = await this.partnersRepository.findOne({
      where: { name: name, deleted: false },
    });

    return partner;
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

  /**
   * Refresca los access keys de un partner generando nuevos valores seguros
   * @param id ID del partner
   * @returns Partner actualizado con nuevos access keys
   */
  async refreshAccessKeys(id: number): Promise<Partner> {
    const partner = await this.findById(id);
    
    // Generar nuevos access keys
    const newAccessKeys = await this.generateAccessKeys();
    
    // Actualizar el partner con los nuevos keys
    partner.app_key = newAccessKeys.app_key;
    partner.app_secret = newAccessKeys.app_secret;
    
    const updatedPartner = await this.partnersRepository.save(partner);
    
    this.logger.log(`Refreshed access keys for partner ${id}. New app_key: ${updatedPartner.app_key.substring(0, 8)}...`);
    
    return updatedPartner;
  }

  /**
   * Deshabilita un partner cambiando su status a inactivo
   * @param id ID del partner
   * @returns Partner actualizado con status deshabilitado
   */
  async disable(id: number): Promise<Partner> {
    const partner = await this.findById(id);
    
    // Cambiar status a inactivo (0 = inactivo, 1 = activo)
    partner.status = 0;
    
    const updatedPartner = await this.partnersRepository.save(partner);
    
    this.logger.log(`Disabled partner ${id}. Status set to: ${updatedPartner.status}`);
    
    return updatedPartner;
  }

  /**
   * Genera access keys seguros usando crypto
   * @returns Objeto con app_key y app_secret generados
   */
  private async generateAccessKeys(): Promise<{ app_key: string; app_secret: string }> {
    // Generar un timestamp para unicidad
    const timestamp = Date.now().toString();
    
    // Generar bytes aleatorios seguros
    const randomKey = randomBytes(32).toString('hex');
    const randomSecret = randomBytes(64).toString('hex');
    
    // Crear app_key: prefijo + hash de timestamp + random
    const keyData = `${timestamp}-${randomKey}`;
    const app_key = `mrp_${createHash('sha256').update(keyData).digest('hex').substring(0, 40)}`;
    
    // Crear app_secret: hash más largo para mayor seguridad
    const secretData = `${timestamp}-${randomSecret}-${randomKey}`;
    const app_secret = createHash('sha256').update(secretData).digest('hex');
    
    // Asegurar unicidad comprobando que no existan en la base de datos
    const existingPartner = await this.partnersRepository.findOne({
      where: { app_key },
    });
    
    if (existingPartner) {
      // Si existe (muy improbable), generar nuevos recursivamente
      this.logger.warn(`Generated app_key already exists, regenerating...`);
      return this.generateAccessKeys();
    }
    
    this.logger.log(`Generated new access keys. App key: ${app_key.substring(0, 12)}...`);
    
    return {
      app_key,
      app_secret,
    };
  }

}
