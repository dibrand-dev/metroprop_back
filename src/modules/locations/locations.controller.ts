import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { TokkoMigratorService } from '../cron-tasks/tokko-migrator/tokko-migrator.service';

@Controller('location')
export class LocationsController {
   
  constructor(
    private readonly locationsService: LocationsService,
    private readonly migrator: TokkoMigratorService,
  ) {}
  // --- ENDPOINTS DE NORMALIZACIÓN ---

  @Get('normalize-states')
  async normalizeStatesByCountry(@Query('countryId') countryId: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.normalizeStatesByCountry(Number(countryId));
    return { ok: true };
  }

  @Get('normalize-locations')
  async normalizeLocationsByCountry(@Query('countryId') countryId: number, @Query('stateId') stateId?: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.normalizeLocationsByCountry(Number(countryId), stateId ? Number(stateId) : undefined);
    return { ok: true };
  }

  @Get('normalize-sublocations')
  async normalizeSubLocationsByCountry(@Query('countryId') countryId: number, @Query('locationId') locationId?: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.normalizeSubLocationsByCountry(Number(countryId), locationId ? Number(locationId) : undefined);
    return { ok: true };
  }

  @Get('migrate-missing-full-locations')
  async migrateMissingFullLocations(@Query('countryId') countryId: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.migrateMissingFullLocationsByCountry(Number(countryId));
    return { ok: true };
  }

  @Get('countries')
  getCountries() {
    return this.locationsService.getCountries();
  }

  @Get('getCountryStates')
  getCountryStates(@Query('countryId') countryId: number) {
    return this.locationsService.getCountryStates(countryId);
  }

  @Get('getStateLocations')
  getStateLocations(@Query('stateId') stateId: number) {
    return this.locationsService.getStateLocations(stateId);
  }

  @Get('getLocationChildrens')
  getLocationChildrens(@Query('locationId') locationId: number) {
    return this.locationsService.getLocationChildrens(locationId);
  }

  @Get('getAllLocations')
  getAllLocations(@Query('country_id') countryId?: number) {
    return this.locationsService.getAllLocations(countryId);
  }
}
