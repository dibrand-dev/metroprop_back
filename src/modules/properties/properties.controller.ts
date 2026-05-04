import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { UploadS3Service } from '../cron-tasks/upload-s3/upload-s3.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { CreateDevelopmentDto } from './dto/create-development.dto';
import { UpdateDevelopmentDto } from './dto/update-development.dto';

import { UploadedFiles, UseInterceptors } from '@nestjs/common';

import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { MultipartFormDataInterceptor } from '../../common/interceptors/multipart-form-data.interceptor';
import { EnhancedFileFieldsInterceptor } from '../../common/interceptors/enhanced-file-fields.interceptor';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { Request } from 'express';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly uploadS3Service: UploadS3Service,
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getMultimedia(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.propertiesService.getMultimedia(propertyId);
  }

  /**
   * POST /properties/:propertyId/reset-failed-uploads
   * Resetea a PENDING todos los registros FAILED con URL externa,
   * para que el cron los procese en el próximo ciclo.
   */
  @Post(':propertyId/reset-failed-uploads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async resetFailedUploads(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.propertiesService.resetFailedUploads(propertyId);
  }

  /**
   * POST /properties/:propertyId/force-upload
   * Dispara inmediatamente el proceso de subida a S3 de todas las imágenes
   * y archivos adjuntos con URL externa pendientes para esta propiedad.
   * No espera al siguiente ciclo del cron.
   */
  @Post(':propertyId/force-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async forceUpload(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.uploadS3Service.forceUploadForProperty(propertyId);
  }

  /**
   * POST /properties/development
   * Crear un nuevo emprendimiento
   */
  @Post('development')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  createDevelopment(@Body() createDevelopmentDto: CreateDevelopmentDto) {
    return this.propertiesService.createDevelopment(createDevelopmentDto);
  }

  /**
   * PATCH /properties/development/:id
   * Actualizar un emprendimiento existente
   */
  @Patch('development/:id')
  @UseGuards(JwtAuthGuard)
  updateDevelopment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDevelopmentDto: UpdateDevelopmentDto,
  ) {
    return this.propertiesService.updateDevelopment(id, updateDevelopmentDto);
  }

  /**
   * POST /properties
   * Crear nueva propiedad (con o sin relaciones)
   * 
   * Si se envían images, tags u operations, se crearán automáticamente
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  /**
   * POST /properties/draft
   * Crear un borrador de propiedad
   */
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
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
   * GET /properties/my-properties
   * Listado privado de propiedades de la organización del usuario autenticado, con filtros y paginación
   */
  @Get('my-properties')
  @UseGuards(JwtAuthGuard)
  myProperties(
    @Query() searchDto: SearchPropertiesDto,
    @Req() request: Request,
  ) {
    const user = (request as any).user;
    const organizationId = user?.organization_id ?? user?.organization?.id;

    if (!organizationId) {
      throw new BadRequestException('El usuario autenticado no tiene organization_id asociado');
    }

    return this.propertiesService.searchPanelProperties(searchDto, organizationId);
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
   * POST /properties/trigger-image-upload-cron
   * Dispara manualmente el proceso de subida de imágenes a S3 (cron).
   * Solo para admins.
   */
  @Get('trigger-image-upload-cron')
  @UseGuards(JwtAuthGuard , RolesGuard )
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerImageUploadCron() {
    await this.uploadS3Service.handleImageUploadCron();
    return { message: 'Proceso de subida de imágenes a S3 disparado manualmente.' };
  }

  /**
   * GET /properties/:id
   * Obtener propiedad por ID
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format?: string
  ) {
    return this.propertiesService.findOne(id, format ?? null);
  }

  /**
   * PATCH /properties/status
   * Cambiar estado de una o varias propiedades
   */
  @Patch('status')
  @UseGuards(JwtAuthGuard)
  changeStatus(
    @Body()
    body: {
      id?: number;
      ids?: number[];
      status: number;
    },
  ) {
    return this.propertiesService.changeStatus(body);
  }

  /**
   * PATCH /properties/:id
   * Actualizar una propiedad
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.remove(id);
  }

}
