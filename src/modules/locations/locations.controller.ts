import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { LocationsService } from './locations.service';
import { TokkoMigratorService } from '../cron-tasks/tokko-migrator/tokko-migrator.service';

@Controller('location')
export class LocationsController {
   
  constructor(
    private readonly locationsService: LocationsService,
    private readonly migrator: TokkoMigratorService,
  ) {}
  // --- ENDPOINTS DE NORMALIZACIÓN ---

  @Get('normalize-countries')
  async normalizeCountries() {
    await this.migrator.migrateCountries();
    return { ok: true };
  }

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

  @Get('normalize-neighborhoods')
  async normalizeNeighborhoodsByCountry(@Query('countryId') countryId: number, @Query('locationId') locationId?: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.normalizeNeighborhoodsByCountry(Number(countryId), locationId ? Number(locationId) : undefined);
    return { ok: true };
  }

  @Get('normalize-full-locations')
  async normalizeFullLocationsByCountry(@Query('countryId') countryId: number) {
    if (!countryId) return { error: 'countryId es requerido' };
    await this.migrator.normalizeFullLocationsByCountry(Number(countryId));
    return { ok: true };
  }

  @Get('compare-states')
  async compareStatesWithTokko(
    @Query('countryId', new DefaultValuePipe('1'), ParseIntPipe) countryId: number,
  ) {
    const result = await this.migrator.compareStatesWithTokko(Number(countryId));
    return result;
  }

  @Get('compare-locations')
  async compareLocationsWithTokko(
    @Query('stateId') stateId?: number,
    @Query('countryId', new DefaultValuePipe('1'), ParseIntPipe) countryId: number = 1,
  ) {
    const result = await this.migrator.compareLocationsWithTokko(stateId ? Number(stateId) : undefined, Number(countryId));
    return result;
  }

  @Get('compare-sublocations')
  async compareSubLocationsWithTokko(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('locationId') locationId?: number,
    @Query('countryId', new DefaultValuePipe('1'), ParseIntPipe) countryId: number = 1,
  ) {
    const result = await this.migrator.compareSubLocationsWithTokko(Number(from), Number(to), locationId ? Number(locationId) : undefined, Number(countryId));
    return result;
  }

  @Get('compare-neighborhoods')
  async compareNeighborhoodsWithTokko(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('subLocationId') subLocationId?: number,
    @Query('countryId', new DefaultValuePipe('1'), ParseIntPipe) countryId: number = 1,
  ) {
    const result = await this.migrator.compareNeighborhoodsWithTokko(Number(from), Number(to), subLocationId ? Number(subLocationId) : undefined, Number(countryId));
    return result;
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
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(86400) // 1 día en segundos
  getAllLocations(@Query('country_id') countryId?: string | number) {
    return this.locationsService.getAllLocations(countryId);
  }
}