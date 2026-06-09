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
import { CreateDevelopmentUnitDto } from './dto/create-development-unit.dto';
import { UpdateDevelopmentUnitDto } from './dto/update-development-unit.dto';

import { UploadedFiles, UseInterceptors } from '@nestjs/common';

import { SaveMultimediaDto } from './dto/save-multimedia.dto';
import { MultipartFormDataInterceptor } from '../../common/interceptors/multipart-form-data.interceptor';
import { EnhancedFileFieldsInterceptor } from '../../common/interceptors/enhanced-file-fields.interceptor';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PropertyOwnershipGuard } from '../../common/guards/property-ownership.guard';
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
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
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
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
  updateDevelopment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDevelopmentDto: UpdateDevelopmentDto,
  ) {
    return this.propertiesService.updateDevelopment(id, updateDevelopmentDto);
  }

  /**
   * POST /properties/development/:developmentId/units
   * Crear una nueva unidad dentro de un emprendimiento.
   *
   * El body debe incluir todos los campos de la propiedad (ver CreateDevelopmentUnitDto).
   * La multimedia se envía como multipart/form-data:
   *   - images[]: archivos de imagen
   *   - attached[]: archivos adjuntos
   *   - videos: JSON string con array de {url} para videos externos
   *   - multimedia360: JSON string con array de {url} para tours 360
   * Las URLs de imágenes/adjuntos ya existentes en S3 pueden enviarse
   * como JSON en los campos `images` / `attached` del body.
   */
  @Post('development/:developmentId/units')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    EnhancedFileFieldsInterceptor(
      [{ name: 'images', maxCount: 20 }, { name: 'attached', maxCount: 20 }],
      { endpointDescription: 'POST /properties/development/:developmentId/units' },
    ),
    new MultipartFormDataInterceptor(['videos', 'multimedia360', 'images', 'attached', 'tags']),
  )
  async createDevelopmentUnit(
    @Param('developmentId', ParseIntPipe) developmentId: number,
    @Body() createDevelopmentUnitDto: CreateDevelopmentUnitDto,
    @UploadedFiles() files?: {
      images?: Express.Multer.File[];
      attached?: Express.Multer.File[];
    },
  ) {
    const safeFiles = files ?? {};

    // 1. Validate any uploaded files
    this.propertiesService.validateUploadedFiles(safeFiles);

    // 2. Create the unit (scalar fields + tags only; multimedia handled below)
    const { data: unit, created, warnings } = await this.propertiesService.createDevelopmentUnit(
      developmentId,
      createDevelopmentUnitDto,
    );

    // 3. Build SaveMultimediaDto from URL-based multimedia present in the body
    const saveMultimediaDto: SaveMultimediaDto = {
      videos: (createDevelopmentUnitDto.videos ?? []).map((v) => v.url),
      multimedia360: (createDevelopmentUnitDto.multimedia360 ?? []).map((v) => v.url),
      images: (createDevelopmentUnitDto.images ?? []).map((i) => i.url).filter(Boolean) as string[],
      attached: (createDevelopmentUnitDto.attached ?? []).map((a) => a.file_url).filter(Boolean) as string[],
    };

    const hasMultimedia =
      safeFiles.images?.length ||
      safeFiles.attached?.length ||
      saveMultimediaDto.videos!.length ||
      saveMultimediaDto.multimedia360!.length ||
      saveMultimediaDto.images!.length ||
      saveMultimediaDto.attached!.length;

    let multimediaResult;
    if (hasMultimedia) {
      multimediaResult = await this.propertiesService.saveMultimedia(unit.id!, saveMultimediaDto, safeFiles);
    }

    return {
      data: unit,
      created,
      warnings: warnings?.length ? warnings : undefined,
      ...(multimediaResult ? { multimedia: multimediaResult } : {}),
    };
  }

  /**
   * GET /properties/development/:developmentId/units/:unitId
   * Obtener una unidad específica dentro de un emprendimiento.
   */
  @Get('development/:developmentId/units/:unitId')
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
  getDevelopmentUnit(
    @Param('developmentId', ParseIntPipe) developmentId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
  ) {
    return this.propertiesService.getDevelopmentUnit(developmentId, unitId);
  }

  /**
   * PATCH /properties/development/:developmentId/units/:unitId
   * Actualizar una unidad dentro de un emprendimiento.
   *
   * Todos los campos son opcionales. La multimedia se envía igual que en el POST:
   *   - images[]: archivos de imagen a subir
   *   - attached[]: archivos adjuntos a subir
   *   - videos: JSON string con array de {url} para videos externos
   *   - multimedia360: JSON string con array de {url} para tours 360
   *   - images / attached en el body: URLs ya existentes a conservar
   * Si no se envía ninguna multimedia, el estado actual de la unidad no cambia.
   */
  @Patch('development/:developmentId/units/:unitId')
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
  @UseInterceptors(
    EnhancedFileFieldsInterceptor(
      [{ name: 'images', maxCount: 20 }, { name: 'attached', maxCount: 20 }],
      { endpointDescription: 'PATCH /properties/development/:developmentId/units/:unitId' },
    ),
    new MultipartFormDataInterceptor(['videos', 'multimedia360', 'images', 'attached', 'tags']),
  )
  async updateDevelopmentUnit(
    @Param('developmentId', ParseIntPipe) developmentId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() updateDevelopmentUnitDto: UpdateDevelopmentUnitDto,
    @UploadedFiles() files?: {
      images?: Express.Multer.File[];
      attached?: Express.Multer.File[];
    },
  ) {
    const safeFiles = files ?? {};

    // 1. Validate any uploaded files
    this.propertiesService.validateUploadedFiles(safeFiles);

    // 2. Update scalar fields + tags
    const { data, warnings } = await this.propertiesService.updateDevelopmentUnit(
      developmentId,
      unitId,
      updateDevelopmentUnitDto,
    );

    // 3. Build SaveMultimediaDto from URL-based multimedia in the body
    const saveMultimediaDto: SaveMultimediaDto = {
      videos: (updateDevelopmentUnitDto.videos ?? []).map((v) => v.url),
      multimedia360: (updateDevelopmentUnitDto.multimedia360 ?? []).map((v) => v.url),
      images: (updateDevelopmentUnitDto.images ?? []).map((i) => i.url).filter(Boolean) as string[],
      attached: (updateDevelopmentUnitDto.attached ?? []).map((a) => a.file_url).filter(Boolean) as string[],
    };

    const hasMultimedia =
      safeFiles.images?.length ||
      safeFiles.attached?.length ||
      saveMultimediaDto.videos!.length ||
      saveMultimediaDto.multimedia360!.length ||
      saveMultimediaDto.images!.length ||
      saveMultimediaDto.attached!.length;

    let multimediaResult;
    if (hasMultimedia) {
      multimediaResult = await this.propertiesService.saveMultimedia(unitId, saveMultimediaDto, safeFiles);
    }

    return {
      data,
      warnings: warnings?.length ? warnings : undefined,
      ...(multimediaResult ? { multimedia: multimediaResult } : {}),
    };
  }

  // DELETE UNITS
  @Delete('development/:developmentId/units/:unitId')
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
  async deleteDevelopmentUnit(
    @Param('developmentId', ParseIntPipe) developmentId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
  ) {
    await this.propertiesService.deleteDevelopmentUnit(developmentId, unitId);
    return { message: 'Unidad eliminada correctamente.' };
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
  createDraft(@Body() createDraftDto: CreateDraftPropertyDto, @Req() req: Request) {
    const user = (req as any).user;
    createDraftDto.user_id = user.id;
    createDraftDto.organization_id = user?.organization_id ?? user?.organization?.id;
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
    const hasOrgId = typeof user.organization_id === 'number' && Number.isFinite(user.organization_id);

    if(user.role_id !== UserRole.USER_ROL_SUPER_ADMIN) {
      if(!hasOrgId || user.role_id === UserRole.USER_ROL_COLLABORATOR) {
        searchDto.user_id = user.id;
      } else {
        searchDto.organization_id = user?.organization_id ?? user?.organization?.id;
      }
    }

    return this.propertiesService.searchPanelProperties(searchDto);
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

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  incrementViewCount(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.propertiesService.incrementViewCount(id);
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
      ids: number | number[];
      status: number;
    },
    @Req() req: Request,
  ) {
    return this.propertiesService.changeStatus(body, (req as any).user);
  }

  /**
   * PATCH /properties/republish
   * Cambiar el plan de publicación (hired_plan_id, purchased_plan_id) de una o varias propiedades
   */
  @Patch('republish')
  @UseGuards(JwtAuthGuard)
  republishProperty(
    @Body()
    body: {
      ids: number | number[];
      hired_plan_id: number;
      purchased_plan_id?: number;
      branch_id?: number;
      user_id?: number;
    },
    @Req() req: Request,
  ) {
    return this.propertiesService.republishProperty(body, (req as any).user);
  }


  /**
   * PATCH /properties/change-user
   * Cambiar usuario asignado de una o varias propiedades
   */
  @Patch('change-user')
  @UseGuards(JwtAuthGuard)
  changeUser(
    @Body()
    body: {
      ids: number | number[];
      user_id: number;
    },
    @Req() req: Request,
  ) {
    return this.propertiesService.changeUser(body, (req as any).user);
  }

  /**
   * PATCH /properties/:id
   * Actualizar una propiedad
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
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
  @UseGuards(JwtAuthGuard, PropertyOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.remove(id);
  }

}
