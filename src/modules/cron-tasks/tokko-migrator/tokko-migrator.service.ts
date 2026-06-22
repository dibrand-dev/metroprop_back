import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { ConfigService } from '@nestjs/config';
import { LocationNew } from '@/modules/locations_new/entities/locations_new.entity';


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
  @Cron("0 */2 * * * *")
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
      //await this.normalizeSubLocationsByCountry(1);
      await this.normalizeNeighborhoodsByCountry(1);
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
          const dbState = await queryRunner.manager.findOne('locations_new', { where: { id: state.id } }) as LocationDb | null;
          const updateData: any = {
            name: state.name,
            type: 'state',
            country_id: countryId,
            parent_id: countryId,
            state_id: state.id,
          };
          updateData.full_location = state.name;
          if (!dbState || !dbState.short_location) {
            if (state.short_location) updateData.short_location = state.short_location;
          }

          if (dbState) {
            await queryRunner.manager.update('locations_new', { id: state.id }, updateData);
            this.logger.log(`[normalizeStatesByCountry] State actualizado: ${state.name} (ID: ${state.id})`);
          } else {
            await queryRunner.manager.insert('locations_new', {
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
      let states: LocationNew[] = [];
      if (stateId) {
        const state = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: stateId, type: 'state' } });
        if (state) states = [state];
      } else {
        states = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'state', country_id: countryId, migrated: false, failed_migration_try: LessThan(3) },
          select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location'],
          take: 1
        });
      }
      for (const state of states) {
        // Actualizar state en DB
        const updateState: any = { migrated: false };
        // Obtener info de Tokko
        const response = await axios.get(`${API_STATE}${state.id}/?lang=es_ar&format=json`);
        const detail = response.data;
        await queryRunner.manager.update('locations_new', { id: state.id }, updateState);
        this.logger.log(`[normalizeLocationsByCountry] State actualizado: ${state.name} (ID: ${state.id})`);

        let childrenCount = detail.divisions ? detail.divisions.length : 0;
        let chidlrensInserted = 0;
        // Obtener locations desde Tokko
        if (Array.isArray(detail.divisions)) {
          for (const location of detail.divisions) {
            try {
              const dbLocation = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: location.id } });
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
                this.logger.log(`[normalizeLocationsByCountry] Location ya existe: ${location.name} (ID: ${location.id}). Se omite.`);
                chidlrensInserted++;
                // ########### NO UPDATES IF EXIST FOR THE MOMENT, TO AVOID OVERWRITING MANUAL FIXES ############
                //await queryRunner.manager.update('locations_new', { id: location.id }, updateLoc);
                //this.logger.log(`[normalizeLocationsByCountry] Location actualizado: ${location.name} (ID: ${location.id})`);
              } else {
                await queryRunner.manager.insert('locations_new', {
                  id: location.id,
                  ...updateLoc,
                });
                this.logger.log(`[normalizeLocationsByCountry] Location insertado: ${location.name} (ID: ${location.id})`);
                chidlrensInserted++;
              }
            } catch (err) {
              this.logger.error(`[normalizeLocationsByCountry] Error actualizando location ${location.id}`, err);
            }
          }
        }

        if(childrenCount > 0 && chidlrensInserted < childrenCount) {
          this.logger.warn(`[normalizeLocationsByCountry] No se marcó state ${state.id} como migrado porque hubo errores en las locations hijas. Total hijos: ${childrenCount}, insertados: ${chidlrensInserted}`);
          await queryRunner.manager.increment('locations_new', { id: state.id }, 'failed_migration_try', 1);
        } else {
          // Al terminar, marcar el state como migrado
          await queryRunner.manager.update('locations_new', { id: state.id }, { migrated: true });
        }
        
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
      let locations: LocationNew[] = [];
      if (locationId) {
        const loc = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: locationId, type: 'location' } });
        if (loc) locations = [loc];
      } else {
        locations = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'location', country_id: countryId, migrated: false, failed_migration_try: LessThan(3) },
          select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location'],
          take: 20
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
        await queryRunner.manager.update('locations_new', { id: location.id }, updateLoc);
        this.logger.log(`[normalizeSubLocationsByCountry] Location actualizado: ${location.name} (ID: ${location.id})`);

        // Procesar divisions
        if (Array.isArray(detail.divisions) && detail.divisions.length > 0) {
          let allDivisionsOk = true;
          for (const division of detail.divisions) {
            const dbDivision = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: division.id } });
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
                this.logger.log(`[normalizeSubLocationsByCountry] Division ya existe: ${division.name} (ID: ${division.id}). Se omite.`);
                // #############################################
                // FOR THE MOMENT, IF EXISTS LEAVE IT BE
                // await queryRunner.manager.update('locations_new', { id: division.id }, updateDiv);
                // this.logger.log(`[normalizeSubLocationsByCountry] Division actualizada: ${division.name} (ID: ${division.id})`);
                // #############################################
              } else {
                await queryRunner.manager.insert('locations_new', {
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
            await queryRunner.manager.update('locations_new', { id: location.id }, { migrated: true });
          } else {            
            this.logger.warn(`[normalizeSubLocationsByCountry] No se marcó location ${location.id} como migrada porque hubo errores en las divisiones`);
            await queryRunner.manager.increment('locations_new', { id: location.id }, 'failed_migration_try', 1);
          }
        }
      }
    } catch (e) {
      this.logger.error(`[normalizeSubLocationsByCountry] Error para country ${countryId}`, e);
    }
    await queryRunner.release();
  }

  /**
   * Normaliza neighborhoods (divisions de cada sub-location) de un país o de una location específica
   */
  async normalizeNeighborhoodsByCountry(countryId: number, locationId?: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // Buscar locations a procesar
      let locations: LocationNew[] = [];
      if (locationId) {
        const loc = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: locationId, type: 'sub_location' } });
        if (loc) locations = [loc];
      } else {
        locations = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'sub_location', country_id: countryId, migrated: false, failed_migration_try: LessThan(5) },
          select: ['id', 'name', 'type', 'migrated', 'country_id', 'parent_id', 'full_location', 'short_location'],
          take: 50,
        });
      }

      this.logger.log(`[normalizeNeighborhoodByCountry] Procesando ${locations.length} locations para country ${countryId}`);
      
      for (const location of locations) {
        // wait 1 second between requests to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          this.logger.log(`[normalizeNeighborhoodByCountry] Procesando location ${location.name} (ID: ${location.id}) con parent_id ${location.parent_id} y full_location "${location.full_location}"`);
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
          await queryRunner.manager.update('locations_new', { id: location.id }, updateLoc);
          this.logger.log(`[normalizeNeighborhoodByCountry] Location actualizado: ${location.name} (ID: ${location.id})`);

          // Procesar divisions
          if (Array.isArray(detail.divisions)) {
            this.logger.log(`[normalizeNeighborhoodByCountry] Procesando ${detail.divisions.length} divisiones para location ${location.name} (ID: ${location.id})`);
            let allDivisionsOk = true;
            for (const division of detail.divisions) {
              const dbDivision = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: division.id } });
              const updateDiv: any = {
                name: division.name,
                type: 'neighborhood',
                parent_id: location.id,
                state_id: location.state_id,
                country_id: countryId,
                migrated: true,
                full_location: division.name + ', ' + location.name,
              };
              if (division.short_location) updateDiv.short_location = division.short_location;
              try {
                if (dbDivision) {
                  
                  // #############################################
                  // FOR THE MOMENT, IF EXISTS LEAVE IT BE
                  // await queryRunner.manager.update('locations_new', { id: division.id }, updateDiv);
                  // this.logger.log(`[normalizeNeighborhoodByCountry] Division actualizada: ${division.name} (ID: ${division.id})`);
                  // #############################################

                } else {
                  await queryRunner.manager.insert('locations_new', {
                    id: division.id,
                    ...updateDiv,
                  });
                  this.logger.log(`[normalizeNeighborhoodByCountry] Division insertada: ${division.name} (ID: ${division.id})`);
                }
              } catch (err) {
                allDivisionsOk = false;
                this.logger.error(`[normalizeNeighborhoodByCountry] Error actualizando division ${division.id}`, err);
                this.logger.error(err);
              }
            }
            // Si todas las divisions OK, marcar location como migrada
            if (allDivisionsOk) {
              await queryRunner.manager.update('locations_new', { id: location.id }, { migrated: true });
            } else {
              this.logger.warn(`[normalizeNeighborhoodByCountry] No se marcó location ${location.id} como migrada porque hubo errores en las divisiones`);
              await queryRunner.manager.increment(
                'locations_new',              
                { id: location.id },      
                'failed_migration_try',
                1
              );
            }
          } 
        } catch (err) {
          this.logger.error(`[normalizeNeighborhoodByCountry] Error procesando location ${location.id}`, err);
          this.logger.error(err);
          continue; 
        }
      }
    } catch (e) {
      this.logger.error(`[normalizeNeighborhoodByCountry] Error para country ${countryId}`, e);
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
      const locations: LocationNew[] = await queryRunner.manager.getRepository(LocationNew)
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
        } else if (loc.type === 'location' || loc.type === 'sub_location' || loc.type === 'neighborhood') {
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
            const parentState = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: loc.parent_id } });
            const stateName = parentState?.name || '';
            updateData.full_location = detail.name ? `${detail.name}, ${stateName}` : (loc.name ? `${loc.name}, ${stateName}` : '');
          } else if (loc.type === 'sub_location') {
            const parentLocation = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: loc.parent_id } });
            const locationName = parentLocation?.name || '';
            const parentState = parentLocation ? await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: parentLocation.parent_id } }) : null;
            const stateName = parentState?.name || '';
            updateData.full_location = detail.name ? `${detail.name}, ${locationName}, ${stateName}` : (loc.name ? `${loc.name}, ${locationName}, ${stateName}` : '');
          } else if (loc.type === 'neighborhood') {
            const parentLocation = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: loc.parent_id } });
            const locationName = parentLocation?.name || '';
            const parentState = parentLocation ? await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: parentLocation.state_id } }) : null;
            const stateName = parentState?.name || '';
            updateData.full_location = detail.name ? `${detail.name}, ${locationName}, ${stateName}` : (loc.name ? `${loc.name}, ${locationName}, ${stateName}` : '');
          }

          if (detail.short_location) updateData.short_location = detail.short_location;
          if (Object.keys(updateData).length > 0) {
            await queryRunner.manager.update('locations_new', { id: loc.id }, updateData);
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
        const exists = await queryRunner.manager.findOne('locations_new', { where: { id: country.id } });
        if (exists) continue;
        await queryRunner.manager.insert('locations_new', {
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
 
  // COMPARADORES ENTRE TOKKO Y DB PARA VALIDAR MIGRACION

  /**
   * Compara los states de Tokko con los registros type='state' en locations_new.
   * Si no se pasa countryId, usa 1 (Argentina).
   */
  async compareStatesWithTokko(countryId?: number) {
    countryId = countryId !== undefined ? Number(countryId) : 1;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      this.logger.log(`[compareStatesWithTokko] Iniciando comparación para country ${countryId}`);

      // 1) Request a Tokko para obtener los states
      const response = await axios.get(`${API_COUNTRY}${countryId}/?lang=es_ar&format=json`);
      const detail = response.data;
      const statesFromTokko: Array<{ id: number; name?: string }> = Array.isArray(detail.states) ? detail.states : [];

      // 2) Obtener states desde la DB (locations_new)
      const dbStates: LocationNew[] = await queryRunner.manager.getRepository(LocationNew).find({
        where: { type: 'state', country_id: countryId },
        select: ['id', 'name'],
      });

      const dbStateIds = new Set(dbStates.map(s => s.id));
      const tokkoStateIds = new Set(statesFromTokko.map((s) => s.id));

      // 3) Comparar
      const missingInDb = statesFromTokko.filter(s => !dbStateIds.has(s.id));
      const extraInDb = dbStates.filter(s => !tokkoStateIds.has(s.id));

      const result = {
        countryId,
        tokkoCount: statesFromTokko.length,
        dbCount: dbStates.length,
        ok: missingInDb.length === 0 && extraInDb.length === 0,
        missingInDb: missingInDb.map(s => ({ id: s.id, name: s.name })),
        extraInDb: extraInDb.map(s => ({ id: s.id, name: s.name })),
      };

      this.logger.log(`[compareStatesWithTokko] Resultado: ${result.ok ? 'OK' : 'DISCREPANCIES'}`);
      return result;
    } catch (err) {
      this.logger.error('[compareStatesWithTokko] Error comparando states con Tokko', err);
      this.logger.error(`${API_COUNTRY}${countryId}/?lang=es_ar&format=json`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Compara locations (divisions) de Tokko con registros type='location' en locations_new.
   * Si se pasa stateId, procesa solo ese state; si no, procesa todos los states del country (countryId opcional).
   * signature: compareLocationsWithTokko(stateId?: number, countryId?: number)
   */
  async compareLocationsWithTokko(stateId?: number, countryId: number = 1) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      this.logger.log(`[compareLocationsWithTokko] Iniciando comparación. stateId=${stateId ?? 'ALL'} countryId=${countryId}`);

      // 1) Obtener lista de states a procesar
      let statesToProcess: LocationNew[] = [];
      if (stateId) {
        const s = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: Number(stateId), type: 'state' } });
        if (s) statesToProcess = [s];
      } else {
        statesToProcess = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'state', country_id: Number(countryId) },
          select: ['id', 'name'],
        });
      }

      const results: Array<any> = [];

      // 2) Para cada state, pedir Tokko y comparar
      for (const state of statesToProcess) {
        try {
          const response = await axios.get(`${API_STATE}${state.id}/?lang=es_ar&format=json`);
          const detail = response.data;
          const divisions: Array<{ id: number; name?: string }> = Array.isArray(detail.divisions) ? detail.divisions : [];

          // Obtener locations en DB con parent_id = state.id y type = 'location'
          const dbLocations: LocationNew[] = await queryRunner.manager.getRepository(LocationNew).find({
            where: { type: 'location', parent_id: state.id },
            select: ['id', 'name'],
          });

          const dbIds = new Set(dbLocations.map(l => l.id));
          const tokkoIds = new Set(divisions.map(d => d.id));

          const missingInDb = divisions.filter(d => !dbIds.has(d.id));
          const extraInDb = dbLocations.filter(l => !tokkoIds.has(l.id));

          results.push({
            stateId: state.id,
            stateName: state.name,
            tokkoCount: divisions.length,
            dbCount: dbLocations.length,
            ok: missingInDb.length === 0 && extraInDb.length === 0,
            missingInDb: missingInDb.map(d => ({ id: d.id, name: d.name })),
            extraInDb: extraInDb.map(l => ({ id: l.id, name: l.name })),
          });

          this.logger.log(`[compareLocationsWithTokko] State ${state.id} processed: tokko=${divisions.length} db=${dbLocations.length}`);
        } catch ( err) {
          this.logger.error(`[compareLocationsWithTokko] Error procesando state ${state.id}`, err);
          results.push({
            stateId: state.id,
            stateName: state.name,
            error: true,
            message: err ,
          });
        }
      }

      return results;
    } catch (err) {
      this.logger.error('[compareLocationsWithTokko] Error general', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Compara sublocations (divisions de una location) con registros type='sub_location' en locations_new.
   * Si se pasa locationId, procesa solo esa location; si no, procesa todas las locations (puede ser costoso).
   */
  async compareSubLocationsWithTokko(from: number, to: number, locationId?: number, countryId: number = 1) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      this.logger.log(`[compareSubLocationsWithTokko] Iniciando comparación. locationId=${locationId ?? 'ALL'} countryId=${countryId}`);

      // 1) Obtener lista de locations a procesar
      let locationsToProcess: LocationNew[] = [];
      if (locationId) {
        const loc = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: locationId, type: 'location' } });
        if (loc) locationsToProcess = [loc];
      } else {
        // Ojo: puede ser muchas locations; el usuario ya dijo que está bien por ahora
        locationsToProcess = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'location', country_id: Number(countryId) },
          select: ['id', 'name', 'parent_id'],
        });
      }

      const results: Array<any> = [];

      const locationsSliced = locationsToProcess.slice(from, to);
      
      for (const location of locationsSliced) {
        try {
          const response = await axios.get(`${API_LOCATION}${location.id}/?lang=es_ar&format=json`);
          const detail = response.data;
          const divisions: Array<{ id: number; name?: string }> = Array.isArray(detail.divisions) ? detail.divisions : [];

          // Obtener sublocations en DB con parent_id = location.id y type = 'sub_location'
          const dbSublocations: LocationNew[] = await queryRunner.manager.getRepository(LocationNew).find({
            where: { type: 'sub_location', parent_id: location.id },
            select: ['id', 'name'],
          });

          const dbIds = new Set(dbSublocations.map(s => s.id));
          const tokkoIds = new Set(divisions.map(d => d.id));

          const missingInDb = divisions.filter(d => !dbIds.has(d.id));
          const extraInDb = dbSublocations.filter(s => !tokkoIds.has(s.id));

          results.push({
            locationId: location.id,
            locationName: location.name,
            tokkoCount: divisions.length,
            dbCount: dbSublocations.length,
            ok: missingInDb.length === 0 && extraInDb.length === 0,
            missingInDb: missingInDb.map(d => ({ id: d.id, name: d.name })),
            extraInDb: extraInDb.map(s => ({ id: s.id, name: s.name })),
          });

          this.logger.log(`[compareSubLocationsWithTokko] Location ${location.id} processed: tokko=${divisions.length} db=${dbSublocations.length}`);
        } catch (err) {
          this.logger.error(`[compareSubLocationsWithTokko] Error procesando location ${location.id}`, err);
          results.push({
            locationId: location.id,
            locationName: location.name,
            error: true,
            message: err ,
          });
        }
      }

      return results;
    } catch (err) {
      this.logger.error('[compareSubLocationsWithTokko] Error general', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Compara neighborhoods (divisions de una sub_location) con registros type='neighborhood' en locations_new.
   * Si se pasa subLocationId, procesa solo esa sublocation; si no, procesa todas las sublocations (costoso).
   */
  async compareNeighborhoodsWithTokko(from: number, to: number, subLocationId?: number, countryId: number = 1) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      this.logger.log(`[compareNeighborhoodsWithTokko] Iniciando comparación. subLocationId=${subLocationId ?? 'ALL'} countryId=${countryId}`);

      // 1) Obtener lista de sublocations a procesar
      let sublocationsToProcess: LocationNew[] = [];
      if (subLocationId) {
        const loc = await queryRunner.manager.getRepository(LocationNew).findOne({ where: { id: subLocationId, type: 'sub_location' } });
        if (loc) sublocationsToProcess = [loc];
      } else {
        // Puede ser muchas filas; el usuario ya indicó que está bien por ahora
        sublocationsToProcess = await queryRunner.manager.getRepository(LocationNew).find({
          where: { type: 'sub_location', country_id: Number(countryId) },
          select: ['id', 'name', 'parent_id', 'state_id'],
        });
      }

      const results: Array<any> = [];

      for (const subloc of sublocationsToProcess.slice(from, to)) {
        try {
          const response = await axios.get(`${API_LOCATION}${subloc.id}/?lang=es_ar&format=json`);
          const detail = response.data;
          const divisions: Array<{ id: number; name?: string }> = Array.isArray(detail.divisions) ? detail.divisions : [];

          // Obtener neighborhoods en DB con parent_id = subloc.id y type = 'neighborhood'
          const dbNeighborhoods: LocationNew[] = await queryRunner.manager.getRepository(LocationNew).find({
            where: { type: 'neighborhood', parent_id: subloc.id },
            select: ['id', 'name'],
          });

          const dbIds = new Set(dbNeighborhoods.map(n => n.id));
          const tokkoIds = new Set(divisions.map(d => d.id));

          const missingInDb = divisions.filter(d => !dbIds.has(d.id));
          const extraInDb = dbNeighborhoods.filter(n => !tokkoIds.has(n.id));

          results.push({
            subLocationId: subloc.id,
            subLocationName: subloc.name,
            tokkoCount: divisions.length,
            dbCount: dbNeighborhoods.length,
            ok: missingInDb.length === 0 && extraInDb.length === 0,
            missingInDb: missingInDb.map(d => ({ id: d.id, name: d.name })),
            extraInDb: extraInDb.map(n => ({ id: n.id, name: n.name })),
          });

          this.logger.log(`[compareNeighborhoodsWithTokko] Sublocation ${subloc.id} processed: tokko=${divisions.length} db=${dbNeighborhoods.length}`);
        } catch (err) {
          this.logger.error(`[compareNeighborhoodsWithTokko] Error procesando sublocation ${subloc.id}`, err);
          results.push({
            subLocationId: subloc.id,
            subLocationName: subloc.name,
            error: true,
            message: err ,
          });
        }
      }

      return results;
    } catch (err) {
      this.logger.error('[compareNeighborhoodsWithTokko] Error general', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }


}
