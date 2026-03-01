import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('location')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

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
}
