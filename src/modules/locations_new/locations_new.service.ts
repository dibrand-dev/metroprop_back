import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationNew } from './entities/locations_new.entity';
import { Not } from 'typeorm';

@Injectable()
export class LocationsNewService {
  constructor(
    @InjectRepository(LocationNew)
    private readonly locationRepository: Repository<LocationNew>,
  ) {}

  async getCountries() {
    return this.locationRepository.find({ where: { type: 'country' }, order: { name: 'ASC' } });
  }

  async getCountryStates(countryId: number) {
    return this.locationRepository.find({ where: { type: 'state', parent_id: countryId }, order: { name: 'ASC' } });
  }

  async getStateLocations(stateId: number) {
    return this.locationRepository.find({ where: { type: 'location', parent_id: stateId }, order: { name: 'ASC' } });
  }

  async getLocationChildrens(locationId: number) {
    return this.locationRepository.find({ where: { parent_id: locationId }, order: { name: 'ASC' } });
  }

  async getSubLocationNeighborhoods(subLocationId: number) {
    return this.locationRepository.find({ where: { type: 'neighborhood', parent_id: subLocationId }, order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<LocationNew | null> {
    return this.locationRepository.findOne({ where: { id } });
  }

  async getAllLocations(countryId?: string | number): Promise<LocationNew[]> {
    const where: any = { type: Not('country') };
    if (countryId) {
      if (typeof countryId === 'string' && countryId.includes(',')) {
        // String separado por coma: usar IN
        const ids = countryId.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
        where.country_id = ids.length > 0 ? ids : undefined;
      } else {
        // Número o string simple
        where.country_id = Number(countryId);
      }
    }
    return this.locationRepository.find({ where, order: { name: 'ASC' } });
  }
}
