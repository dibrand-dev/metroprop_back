import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { ConfigService } from '@nestjs/config';


interface LocationDb {
  id: number;
  name?: string;
  type?: string;
  migrated?: boolean;
  country_id?: number;
  parent_id?: number;
  full_location?: string;
  short_location?: string;
}

const TOKKO_DOMAIN = 'https://www.tokkobroker.com';
const API_COUNTRIES = `${TOKKO_DOMAIN}/api/v1/countries/?lang=es_ar&format=json`;
const API_COUNTRY = `${TOKKO_DOMAIN}/api/v1/country/`;
const API_STATE = `${TOKKO_DOMAIN}/api/v1/state/`;
const API_LOCATION = `${TOKKO_DOMAIN}/api/v1/location/`;

@Injectable()
export class TokkoMigratorService {
  private readonly logger = new Logger(TokkoMigratorService.name);
  

  constructor(private readonly dataSource: DataSource, private readonly configService: ConfigService) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleMigration() {
    this.logger.log('Iniciando migración automática de locations desde Tokko...');
    const enabled = this.configService.get<string>('FEATURE_FLAG_TOKKO_SYNC');
		if (enabled === 'false') {
			this.logger.debug('[TokkoSync] Sync disabled via FEATURE_FLAG_TOKKO_SYNC=false');
			return;
		}

    try {

      // Ejecutar una unica vez la normalización de states y locations para countryId=1 (Argentina) O EL COUNTRY QUE SE REQUIERA
      // Luego ejecutar periódicamente la normalización de sublocations para mantener actualizada la info. 
      // Una vez todas las locations esten migradas y las sublocations tengan su nuevo type y full location podemos ejecutar 
      // una ultima normalizacion para todos los campos q no tengan full location guardado por algun motivo 
      // normalizeFullLocationsByCountry 


      //await this.normalizeStatesByCountry(1);
      //await this.normalizeLocationsByCountry(1);
      await this.normalizeSubLocationsByCountry(1);
      //await this.normalizeFullLocationsByCountry(1);

      this.logger.log('Normalización de sublocations ejecutada para countryId=1');
    } catch (e) {
      this.logger.error('Error en normalización de sublocations', e);
    }
    this.logger.log('Migración automática finalizada.');
  }

  /**
   * Normaliza los states de un país: actualiza country_id, parent_id, full_location y short_location
   */
  async normalizeStatesByCountry(countryId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Obtener states desde Tokko
      const response = await axios.get(`${API_COUNTRY}${countryId}/?lang=es_ar&format=json`);
      const detail = response.data;
      if (Array.isArray(detail.states)) {
        for (const state of detail.states) {
          // Crear o actualizar el state en la DB
          const dbState = await queryRunner.manager.findOne('locations', { where: { id: state.id } }) as LocationDb | null;
          const updateData: any = {
            name: state.name,
            type: 'state',
            country_id: countryId,
            parent_id: countryId,
          };
          updateData.full_location = state.name;
          if (!dbState || !dbState.short_location) {
            if (state.short_location) updateData.short_location = state.short_location;
          }

          if (dbState) {
            await queryRunner.manager.update('locations', { id: state.id }, updateData);
            this.logger.log(`[normalizeStatesByCountry] State actualizado: ${state.name} (ID: ${state.id})`);
          } else {
            await queryRunner.manager.insert('locations', {
              id: state.id,
              migrated: false,
              ...updateData,
            });
            this.logger.log(`[normalizeStatesByCountry] State insertado: ${state.name} (ID: ${state.id})`);
          }
        }
      }
    } catch (e) {
      this.logger.error(`[normalizeStatesByCountry] Error para country ${countryId}`, e);
    }
    await queryRunner.release();
  }

  /**
   * Normaliza locations de un país (o de un state específico): country_id, migrated, full_location, short_location
   */
  async normalizeLocationsByCountry(countryId: number, stateId?: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Buscar states a procesar
      let states: Location[] = [];
      if (stateId) {
        const state = await queryRunner.manager.getRepository(Location).findOne({ where: { id: stateId, type: 'state' } });
        if (state) states = [state];
      } else {
        states = await queryRunner.manager.getRepository(Location).find({
          where: { type: 'state', country_id: countryId },
          select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location']
        });
      }
      for (const state of states) {
        // Actualizar state en DB
        const updateState: any = { migrated: false };
        // Obtener info de Tokko
        const response = await axios.get(`${API_STATE}${state.id}/?lang=es_ar&format=json`);
        const detail = response.data;
        await queryRunner.manager.update('locations', { id: state.id }, updateState);
        this.logger.log(`[normalizeLocationsByCountry] State actualizado: ${state.name} (ID: ${state.id})`);

        // Obtener locations desde Tokko
        if (Array.isArray(detail.divisions)) {
          for (const location of detail.divisions) {
            const dbLocation = await queryRunner.manager.getRepository(Location).findOne({ where: { id: location.id } });
            const updateLoc: any = {
              name: location.name,
              type: 'location',
              parent_id: state.id,
              country_id: countryId,
              migrated: false,
            };
            updateLoc.full_location = location.name + ', ' + state.name;
            if (location.short_location) updateLoc.short_location = location.short_location;

            if (dbLocation) {
              await queryRunner.manager.update('locations', { id: location.id }, updateLoc);
              this.logger.log(`[normalizeLocationsByCountry] Location actualizado: ${location.name} (ID: ${location.id})`);
            } else {
              await queryRunner.manager.insert('locations', {
                id: location.id,
                ...updateLoc,
              });
              this.logger.log(`[normalizeLocationsByCountry] Location insertado: ${location.name} (ID: ${location.id})`);
            }
          }
        }
        // Al terminar, marcar el state como migrado
        await queryRunner.manager.update('locations', { id: state.id }, { migrated: true });
      }
    } catch (e) {
      this.logger.error(`[normalizeLocationsByCountry] Error para country ${countryId}`, e);
    }
    await queryRunner.release();
  }

  /**
   * Normaliza sublocations (divisions) de un país o de una location específica
   */
  async normalizeSubLocationsByCountry(countryId: number, locationId?: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Buscar locations a procesar
      let locations: Location[] = [];
      if (locationId) {
        const loc = await queryRunner.manager.getRepository(Location).findOne({ where: { id: locationId, type: 'location' } });
        if (loc) locations = [loc];
      } else {
        locations = await queryRunner.manager.getRepository(Location).find({
          where: { type: 'location', country_id: countryId, migrated: false },
          select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location']
        });
      }
      for (const location of locations) {
        // Obtener info de Tokko
        const response = await axios.get(`${API_LOCATION}${location.id}/?lang=es_ar&format=json`);
        const detail = response.data;
        // Actualizar location en DB
        const updateLoc: any = {};
        if (Array.isArray(detail.divisions) && detail.divisions.length > 0) {
          updateLoc.migrated = false;
        } else {
          updateLoc.migrated = true;
        }
        await queryRunner.manager.update('locations', { id: location.id }, updateLoc);
        this.logger.log(`[normalizeSubLocationsByCountry] Location actualizado: ${location.name} (ID: ${location.id})`);

        // Procesar divisions
        if (Array.isArray(detail.divisions)) {
          let allDivisionsOk = true;
          for (const division of detail.divisions) {
            const dbDivision = await queryRunner.manager.getRepository(Location).findOne({ where: { id: division.id } });
            const updateDiv: any = {
              name: division.name,
              type: 'sub_location',
              parent_id: location.id,
              state_id: location.parent_id,
              country_id: countryId,
              migrated: true,
              full_location: division.name + ', ' + location.name,
            };
            if (division.short_location) updateDiv.short_location = division.short_location;
            try {
              if (dbDivision) {
                await queryRunner.manager.update('locations', { id: division.id }, updateDiv);
                this.logger.log(`[normalizeSubLocationsByCountry] Division actualizada: ${division.name} (ID: ${division.id})`);
              } else {
                await queryRunner.manager.insert('locations', {
                  id: division.id,
                  ...updateDiv,
                });
                this.logger.log(`[normalizeSubLocationsByCountry] Division insertada: ${division.name} (ID: ${division.id})`);
              }
            } catch (err) {
              allDivisionsOk = false;
              this.logger.error(`[normalizeSubLocationsByCountry] Error actualizando division ${division.id}`, err);
            }
          }
          // Si todas las divisions OK, marcar location como migrada
          if (allDivisionsOk) {
            await queryRunner.manager.update('locations', { id: location.id }, { migrated: true });
          }
        }
      }
    } catch (e) {
      this.logger.error(`[normalizeSubLocationsByCountry] Error para country ${countryId}`, e);
    }
    await queryRunner.release();
  }

  /**
   * Migra y completa el campo full_location para cualquier location (state, location, sub_location)
   * que tenga full_location vacío, para un country dado.
   * Consulta la API correspondiente según el tipo.
   */
  async normalizeFullLocationsByCountry(countryId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Buscar todas las locations del país con full_location vacío
      // Buscar los que tienen full_location NULL o string vacío
      const locations: Location[] = await queryRunner.manager.getRepository(Location)
        .createQueryBuilder('location')
        .where('location.country_id = :countryId', { countryId })
        .andWhere('(location.full_location IS NULL OR location.full_location = \'\')')
        .select(['location.id', 'location.type', 'location.country_id', 'location.parent_id', 'location.full_location', 'location.short_location'])
        .limit(80)
        .getMany();
      for (const loc of locations) {
        let apiUrl = '';
        if (loc.type === 'state') {
          apiUrl = `${API_STATE}${loc.id}/?lang=es_ar&format=json`;
        } else if (loc.type === 'location' || loc.type === 'sub_location') {
          apiUrl = `${API_LOCATION}${loc.id}/?lang=es_ar&format=json`;
        } else {
          continue; // ignorar otros tipos
        }
        try {
          const response = await axios.get(apiUrl);
          const detail = response.data;
          const updateData: any = {};

          if (loc.type === 'state') {
            updateData.full_location = detail.name || loc.name || '';
          } else if (loc.type === 'location') {
            const parentState = await queryRunner.manager.getRepository(Location).findOne({ where: { id: loc.parent_id } });
            const stateName = parentState?.name || '';
            updateData.full_location = detail.name ? `${detail.name}, ${stateName}` : (loc.name ? `${loc.name}, ${stateName}` : '');
          } else if (loc.type === 'sub_location') {
            const parentLocation = await queryRunner.manager.getRepository(Location).findOne({ where: { id: loc.parent_id } });
            const locationName = parentLocation?.name || '';
            const parentState = parentLocation ? await queryRunner.manager.getRepository(Location).findOne({ where: { id: parentLocation.parent_id } }) : null;
            const stateName = parentState?.name || '';
            updateData.full_location = detail.name ? `${detail.name}, ${locationName}, ${stateName}` : (loc.name ? `${loc.name}, ${locationName}, ${stateName}` : '');
          }

          if (detail.short_location) updateData.short_location = detail.short_location;
          if (Object.keys(updateData).length > 0) {
            await queryRunner.manager.update('locations', { id: loc.id }, updateData);
            this.logger.log(`[normalizeFullLocationsByCountry] Location actualizada: ${loc.id} (${loc.type})`);
          }
        } catch (err) {
          this.logger.error(`[normalizeFullLocationsByCountry] Error actualizando location ${loc.id} (${loc.type})`, err);
        }
      }
    } catch (e) {
      this.logger.error(`[normalizeFullLocationsByCountry] Error general para country ${countryId}`, e);
    }
    await queryRunner.release();
  }

  /************** Migracion basica, reemplazada por la migracion avanzada con normalizacion completa **************/
  
  async migrateCountries() {
    try {
      const response = await axios.get(API_COUNTRIES);
      const data = response.data;
      if (!Array.isArray(data.objects)) return;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      for (const country of data.objects) {
        const exists = await queryRunner.manager.findOne('locations', { where: { id: country.id } });
        if (exists) continue;
        await queryRunner.manager.insert('locations', {
          id: country.id,
          name: country.name,
          iso_code: country.iso_code || null,
          type: 'country',
        });
        this.logger.log(`Insertado país: ${country.name} (ID: ${country.id})`);
      }
      await queryRunner.release();
    } catch (e) {
      this.logger.error('Error migrando países', e);
    }
  }

  async migrateStates() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const countries: Location[] = await queryRunner.manager.getRepository(Location).find({
      where: { type: 'country' },
      select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location']
    });
    for (const country of countries) {
      try {
        const response = await axios.get(`${API_COUNTRY}${country.id}/?lang=es_ar&format=json`);
        const detail = response.data;
        if (Array.isArray(detail.states)) {
          for (const state of detail.states) {
            const exists = await queryRunner.manager.findOne('locations', { where: { id: state.id } });
            if (exists) continue;
            await queryRunner.manager.insert('locations', {
              id: state.id,
              name: state.name,
              parent_id: country.id,
              type: 'state',
            });
            this.logger.log(`Insertado state: ${state.name} (ID: ${state.id})`);
          }
        }
      } catch (e) {
        this.logger.error(`Error migrando states para country ${country.id}`, e);
      }
    }
    await queryRunner.release();
  }

  async migrateLocations(limit = 50) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const states: Location[] = await queryRunner.manager.getRepository(Location).find({
      where: { type: 'state' },
      select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location']
    });
    for (const state of states.slice(0, limit)) {
      try {
        const response = await axios.get(`${API_STATE}${state.id}/?lang=es_ar&format=json`);
        const detail = response.data;
        if (Array.isArray(detail.divisions)) {
          for (const location of detail.divisions) {
            const updateData: any = {
              name: location.name,
              parent_id: state.id,
              type: 'location',
              country_id: state.country_id ?? null,
              migrated: false,
            };
            if (location.full_location) updateData.full_location = location.full_location;
            if (location.short_location) updateData.short_location = location.short_location;
            const exists = await queryRunner.manager.findOne('locations', { where: { id: location.id } });
            if (exists) {
              await queryRunner.manager.update('locations', { id: location.id }, updateData);
              this.logger.log(`[migrateLocations] Location actualizado: ${location.name} (ID: ${location.id})`);
            } else {
              await queryRunner.manager.insert('locations', {
                id: location.id,
                ...updateData,
              });
              this.logger.log(`[migrateLocations] Location insertado: ${location.name} (ID: ${location.id})`);
            }
          }
        }
        await queryRunner.manager.update('locations', { id: state.id }, { migrated: true });
      } catch (e) {
        this.logger.error(`Error migrando locations para state ${state.id}`, e);
      }
    }
    await queryRunner.release();
  }

  async migrateDivisions(limit = 100) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const locations: Location[] = await queryRunner.manager.getRepository(Location).find({
      where: { type: 'location', migrated: false },
      select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location']
    });
    for (const location of locations.slice(0, limit)) {
      try {
        // Obtener info de la location desde Tokko
        const response = await axios.get(`${API_LOCATION}${location.id}/?lang=es_ar&format=json`);
        const detail = response.data;

        // Actualizar la location con country_id, full_location, short_location
        const updateLoc: any = {};
        if (detail.country && detail.country.id) updateLoc.country_id = detail.country.id;
        if (detail.full_location) updateLoc.full_location = detail.full_location;
        if (detail.short_location) updateLoc.short_location = detail.short_location;
        await queryRunner.manager.update('locations', { id: location.id }, updateLoc);

        let allDivisionsOk = true;
        if (Array.isArray(detail.divisions) && detail.divisions.length > 0) {
          for (const division of detail.divisions) {
            try {
              // Obtener info de la division desde Tokko
              const divResponse = await axios.get(`${API_LOCATION}${division.id}/?lang=es_ar&format=json`);
              const divDetail = divResponse.data;
              // Actualizar division existente
              const dbDivision = await queryRunner.manager.getRepository(Location).findOne({ where: { id: division.id } });
              if (!dbDivision) continue;
              const updateDiv: any = {
                type: 'sub_location',
                migrated: true,
              };
              if (detail.country && detail.country.id) updateDiv.country_id = detail.country.id;
              if (divDetail.full_location) updateDiv.full_location = divDetail.full_location;
              if (divDetail.short_location) updateDiv.short_location = divDetail.short_location;
              await queryRunner.manager.update('locations', { id: division.id }, updateDiv);
              this.logger.log(`[migrateDivisions] Division actualizada: ${division.name} (ID: ${division.id})`);
            } catch (err) {
              allDivisionsOk = false;
              this.logger.error(`[migrateDivisions] Error actualizando division ${division.id}`, err);
            }
          }
          // Si todas las divisions OK, marcar location como migrada
          if (allDivisionsOk) {
            await queryRunner.manager.update('locations', { id: location.id }, { migrated: true });
          }
        } else {
          // Si no tiene divisions, marcar como migrada
          await queryRunner.manager.update('locations', { id: location.id }, { migrated: true });
        }
      } catch (e) {
        this.logger.error(`[migrateDivisions] Error migrando divisiones para location ${location.id}`, e);
      }
    }
    await queryRunner.release();
  }

}
