import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreatePropertyWithRelationsDto } from './dto/create-property-with-relations.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  /**
   * POST /properties
   * Crear nueva propiedad (sin relaciones)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  /**
   * POST /properties/with-relations
   * Crear nueva propiedad con imágenes, tags y operaciones
   */
  @Post('with-relations')
  @HttpCode(HttpStatus.CREATED)
  createWithRelations(
    @Body() createPropertyWithRelationsDto: CreatePropertyWithRelationsDto,
  ) {
    return this.propertiesService.createWithRelations(
      createPropertyWithRelationsDto,
    );
  }

  /**
   * GET /properties
   * Obtener todas las propiedades con paginación y filtros
   */
  @Get()
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
    @Query('property_type') property_type?: string,
    @Query('status') status?: string,
    @Query('min_price') min_price?: string,
    @Query('max_price') max_price?: string,
  ) {
    const filters = {
      property_type: property_type ? parseInt(property_type) : undefined,
      status: status ? parseInt(status) : undefined,
      min_price: min_price ? parseFloat(min_price) : undefined,
      max_price: max_price ? parseFloat(max_price) : undefined,
    };

    return this.propertiesService.findAll(
      parseInt(skip),
      parseInt(take),
      filters,
    );
  }

  /**
   * GET /properties/search
   * Buscar propiedades por texto
   */
  @Get('search')
  search(@Query('q') query: string) {
    if (!query) {
      return { error: 'Parámetro de búsqueda requerido' };
    }
    return this.propertiesService.search(query);
  }

  /**
   * GET /properties/stats
   * Obtener estadísticas de propiedades
   */
  @Get('stats')
  getStats() {
    return this.propertiesService.getStats();
  }

  /**
   * GET /properties/:id
   * Obtener propiedad por ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(parseInt(id));
  }

  /**
   * GET /properties/ref/:reference_code
   * Obtener propiedad por reference_code
   */
  @Get('ref/:reference_code')
  findByReferenceCode(@Param('reference_code') reference_code: string) {
    return this.propertiesService.findByReferenceCode(reference_code);
  }

  /**
   * PATCH /properties/:id
   * Actualizar una propiedad
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(parseInt(id), updatePropertyDto);
  }

  /**
   * DELETE /properties/:id
   * Eliminar lógico (soft delete) una propiedad
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(parseInt(id));
  }

  /**
   * PATCH /properties/:id/restore
   * Restaurar una propiedad eliminada
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.propertiesService.restore(parseInt(id));
  }
}
