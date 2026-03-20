import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { Not } from 'typeorm';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
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

  async findById(id: number): Promise<Location | null> {
    return this.locationRepository.findOne({ where: { id } });
  }

  async getAllLocations(): Promise<Location[]> {
    return this.locationRepository.find({ where: { type: Not('country') }, order: { name: 'ASC' } });
  }
}
