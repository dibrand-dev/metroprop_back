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
  ParseIntPipe,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('properties')
export class PropertiesController {
    /**
     * POST /properties/:propertyId/upload-image
     * Sube una imagen a S3 y retorna la URL pública
     */
    @Post(':propertyId/upload-image')
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(
      @Param('propertyId', ParseIntPipe) propertyId: number,
      @UploadedFile() file: Express.Multer.File
    ) {
      if (!file) {
        return { error: 'Archivo no recibido' };
      }

      // Chequear existencia de la propiedad antes de subir
      const property = await this.propertiesService.findOne(propertyId);
      if (!property) {
        return {
          statusCode: 404,
          message: `Property with id ${propertyId} not found. No upload performed.`
        };
      }

      // Asumiendo que el imageId es igual al propertyId, ajustar si es necesario
      const imageId = propertyId;
      const url = await this.propertiesService.uploadImageToS3(file, imageId, propertyId);
      return {
        url,
        propertyId,
        fileName: file.originalname,
        fileSize: file.size,
        status: url ? null : 'Ver campo status en la entidad PropertyImage para detalles de error',
      };
    }
  constructor(private readonly propertiesService: PropertiesService) {}

  /**
   * POST /properties
   * Crear nueva propiedad (con o sin relaciones)
   * 
   * Si se envían images, tags u operations, se crearán automáticamente
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  /**
   * GET /properties/stats
   * Obtener estadísticas de propiedades
   * Nota: DEBE estar antes de GET :id para evitar conflicto
   */
  @Get('stats')
  getStats() {
    return this.propertiesService.getStats();
  }

  /**
   * GET /properties/search
   * Buscar propiedades por texto
   * Nota: DEBE estar antes de GET :id para evitar conflicto
   */
  @Get('search')
  search(@Query('q') query: string) {
    if (!query) {
      return { error: 'Parámetro de búsqueda requerido' };
    }
    return this.propertiesService.search(query);
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
   * GET /properties/ref/:reference_code
   * Obtener propiedad por reference_code
   */
  @Get('ref/:reference_code')
  findByReferenceCode(@Param('reference_code') reference_code: string) {
    return this.propertiesService.findByReferenceCode(reference_code);
  }

  /**
   * GET /properties/:id
   * Obtener propiedad por ID
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.findOne(id);
  }

  /**
   * PATCH /properties/:id
   * Actualizar una propiedad
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, updatePropertyDto);
  }

  /**
   * DELETE /properties/:id
   * Eliminar lógico (soft delete) una propiedad
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.remove(id);
  }

  /**
   * PATCH /properties/:id/restore
   * Restaurar una propiedad eliminada
   */
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.restore(id);
  }
}
