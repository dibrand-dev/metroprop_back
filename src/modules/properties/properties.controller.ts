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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateDraftPropertyDto } from './dto/create-draft-property.dto';

import { UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';

import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { MultipartFormDataInterceptor } from '../../common/interceptors/multipart-form-data.interceptor';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

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
   * - videos: JSON string con array de {url, order}
   * - multimedia360: JSON string con array de {url, order}  
   * - images: JSON string con array de {order_position} (opcional)
   * - attached: JSON string con array de {order, description} (opcional)
   * 
   * Files:
   * - images: Archivos de imagen (image/jpeg, image/png, etc.)
   * - attached: Cualquier tipo de archivo (pdf, doc, etc.)
   */
  @Post(':propertyId/save-multimedia')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 20 },
      { name: 'attached', maxCount: 20 }
    ]),
    new MultipartFormDataInterceptor(['videos', 'multimedia360', 'images', 'attached'])
  )
  async saveMultimedia(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Body() saveMultimediaDto: SaveMultimediaDto,
    @UploadedFiles() files: { 
      images?: Express.Multer.File[];
      attached?: Express.Multer.File[];
    },
  ) {
    // Validación personalizada archivo por archivo
    this.validateUploadedFiles(files);
    
    return this.propertiesService.saveMultimedia(
      propertyId,
      saveMultimediaDto,
      files,
    );
  }

  /**
   * Valida cada archivo individualmente para dar mensajes de error específicos
   */
  private validateUploadedFiles(files: { images?: Express.Multer.File[]; attached?: Express.Multer.File[] }) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    const allowedTypes = ['jpg', 'svg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const errors: string[] = [];

    // Validar imágenes
    if (files.images?.length) {
      files.images.forEach((file, index) => {
        // Validar tamaño
        if (file.size > maxSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          errors.push(`Imagen "${file.originalname}" (${fileSizeMB}MB) excede el límite de 25MB`);
        }
        
        // Validar tipo
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          errors.push(`Imagen "${file.originalname}" tiene tipo no válido. Permitidos: ${allowedTypes.join(', ')}`);
        }
      });
    }

    // Validar archivos adjuntos
    if (files.attached?.length) {
      files.attached.forEach((file, index) => {
        // Validar tamaño
        if (file.size > maxSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          errors.push(`Archivo "${file.originalname}" (${fileSizeMB}MB) excede el límite de 25MB`);
        }
        
        // Validar tipo
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          errors.push(`Archivo "${file.originalname}" tiene tipo no válido. Permitidos: ${allowedTypes.join(', ')}`);
        }
      });
    }

    // Si hay errores, lanzar excepción con detalles
    if (errors.length > 0) {
      throw new BadRequestException(`Errores de validación de archivos: ${errors.join('; ')}`);
    }
  }

  /**
   * GET /properties/:propertyId/upload-status
   * Obtener estado de uploads de multimedia para una propiedad
   */
  @Get(':propertyId/upload-status')
  async getUploadStatus(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.propertiesService.getUploadStatus(propertyId);
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
