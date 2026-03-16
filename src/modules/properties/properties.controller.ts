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
  BadRequestException,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';

import { UploadedFiles, UseInterceptors } from '@nestjs/common';

import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { MultipartFormDataInterceptor } from '../../common/interceptors/multipart-form-data.interceptor';
import { EnhancedFileFieldsInterceptor } from '../../common/interceptors/enhanced-file-fields.interceptor';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
  ) {}

  /**
   * POST /properties/:propertyId/save-multimedia
   * Guardar multimedia (videos, imágenes, archivos adjuntos) para una propiedad
   * 
   * @description
   * Este endpoint acepta una combinación de:
   * - URLs de videos/multimedia360 como JSON
   * - Archivos de imagen (images[])
   * - Archivos adjuntos (attached[])
   * - Metadatos de orden y descripción
   * 
   * @example
   * Content-Type: multipart/form-data
   * 
   * Form fields:
   * - videos: JSON string con array de {url, order?, id?} (opcional). El campo `id` permite identificar
   *   un video existente para actualizarlo en lugar de crear uno nuevo.
   * - multimedia360: JSON string con array de {url, order?, id?} (opcional). Similar a videos.
   * - images: JSON string con array de {order_position, url?} (opcional). La propiedad `url` permite indicar
   *   una imagen ya existente en S3 para no volver a subirla, y también sirve para reordenar.
   *   Si sólo se envían archivos sin metadatos, las imágenes nuevas se añadirán al final de las existentes.
   *   Para reemplazar por completo el conjunto de imágenes es necesario enviar metadata que describa
   *   explícitamente las imágenes que se quieran conservar (con sus urls si ya están en S3) o un array vacío.
   * - attached: JSON string con array de {order, description?, file_url?} (opcional). Similar a imágenes,
   *   `file_url` permite conservar archivos ya subidos a S3 sin re-subirlos.
   * 
   * Files:
   * - images: Archivos de imagen (image/jpeg, image/png, etc.)
   * - attached: Cualquier tipo de archivo (pdf, doc, etc.)
   */
  @Post(':propertyId/save-multimedia')
  @UseInterceptors(
    EnhancedFileFieldsInterceptor(
      [{ name: 'images', maxCount: 20 }, { name: 'attached', maxCount: 20 }],
      { endpointDescription: 'POST /properties/:id/save-multimedia' },
    ),
    new MultipartFormDataInterceptor(['videos', 'multimedia360', 'images', 'attached'])
  )
  async saveMultimedia(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Body() saveMultimediaDto: SaveMultimediaDto,
    @UploadedFiles() files?: { 
      images?: Express.Multer.File[];
      attached?: Express.Multer.File[];
    },
  ) {
    const safeFiles = files ?? {};

    // Validación personalizada archivo por archivo
    this.propertiesService.validateUploadedFiles(safeFiles);
    
    return this.propertiesService.saveMultimedia(
      propertyId,
      saveMultimediaDto,
      safeFiles,
    );
  }

  /**
   * GET /properties/:propertyId/multimedia
   * Obtener toda la multimedia de una propiedad (imágenes, videos, videos 360, adjuntos)
   */
  @Get(':propertyId/multimedia')
  async getMultimedia(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.propertiesService.getMultimedia(propertyId);
  }

  /**
   * POST /properties/:propertyId/retry-uploads
   * Reintentar uploads fallidos para una propiedad
   */
  @Post(':propertyId/retry-uploads')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryFailedUploads(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.propertiesService.retryFailedUploads(propertyId);
  }

  /**
   * GET /properties/service-status
   * Obtener estado del servicio S3 y circuit breaker
   * Nota: DEBE estar antes de GET :id para evitar conflicto
   */
  @Get('service-status')
  async getServiceStatus() {
    return this.propertiesService.getS3ServiceStatus();
  }

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
   * POST /properties/draft
   * Crear un borrador de propiedad
   */
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  createDraft(@Body() createDraftDto: CreateDraftPropertyDto) {
    return this.propertiesService.createDraft(createDraftDto);
  }

  /**
   * GET /properties/filter
   * Búsqueda avanzada con múltiples filtros
   *
   * Ejemplos:
   *   /properties/filter?page=1&limit=20&operation_type=1,2&bathroom_amount=1,2,3&price_min=50000
   */
  @Get('filter')
  filter(@Query() searchDto: SearchPropertiesDto) {
    return this.propertiesService.searchProperties(searchDto);
  }

  /**
   * GET /properties/mis-propiedades
   * Listado privado por organization_id
   */
  @Get('mis-propiedades')
  myProperties(@Query() searchDto: SearchPropertiesDto) {
    if (!searchDto.organization_id) {
      throw new BadRequestException(
        'organization_id es obligatorio en mis-propiedades',
      );
    }

    return this.propertiesService.searchPanelProperties(searchDto, searchDto.organization_id);
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

}
