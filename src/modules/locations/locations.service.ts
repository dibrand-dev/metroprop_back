import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  async getCountries() {
    return this.locationRepository.find({ where: { type: 'country' } });
  }

  async getCountryStates(countryId: number) {
    return this.locationRepository.find({ where: { type: 'state', parent_id: countryId } });
  }

  async getStateLocations(stateId: number) {
    return this.locationRepository.find({ where: { type: 'location', parent_id: stateId } });
  }

  async getLocationChildrens(locationId: number) {
    return this.locationRepository.find({ where: { parent_id: locationId } });
  }
}
