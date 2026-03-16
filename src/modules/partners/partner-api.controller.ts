import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { PartnerApiService } from './partner-api.service';
import { LocationsService } from '../locations/locations.service';
import { CreateOrganizationRegistrationDto } from '../registration/dto/create-organization-registration.dto';
import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerPatchImageDto } from './dto/partner-patch-image.dto';
import { PartnerPatchAttachedDto } from './dto/partner-patch-attached.dto';
import { Request } from 'express';

@Controller('api/partner/v1')
@UseGuards(ThrottlerGuard, ApiKeyAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 100 } })
@ApiSecurity('x-api-key')
@ApiSecurity('x-api-secret')
export class PartnerApiController {
  constructor(
    private readonly partnerApiService: PartnerApiService,
    private readonly locationsService: LocationsService,
  ) {}


  // ====== LOCATIONS ======

  @Get('locations/countries')
  @ApiTags('Locations')
  @ApiOperation({
    summary: 'Obtener lista de países',
    description: 'Retorna todos los países disponibles para usar en location_id, state_id, country_id y sublocation_id.',
  })
  @ApiResponse({ status: 200, description: 'Lista de países' })
  getCountries() {
    return this.locationsService.getCountries();
  }

  @Get('locations/states')
  @ApiTags('Locations')
  @ApiOperation({
    summary: 'Obtener provincias/estados de un país',
    description: 'Retorna las provincias o estados de un país dado su country_id.',
  })
  @ApiResponse({ status: 200, description: 'Lista de provincias/estados' })
  getCountryStates(@Query('countryId') countryId: number) {
    return this.locationsService.getCountryStates(countryId);
  }

  @Get('locations/cities')
  @ApiTags('Locations')
  @ApiOperation({
    summary: 'Obtener localidades de una provincia',
    description: 'Retorna las localidades (location_id) de una provincia dado su state_id.',
  })
  @ApiResponse({ status: 200, description: 'Lista de localidades' })
  getStateLocations(@Query('stateId') stateId: number) {
    return this.locationsService.getStateLocations(stateId);
  }

  @Get('locations/sub-locations')
  @ApiTags('Locations')
  @ApiOperation({
    summary: 'Obtener sublocalidades/barrios de una localidad',
    description: 'Retorna sublocalidades o barrios (sublocation_id) de una localidad dado su locationId.',
  })
  @ApiResponse({ status: 200, description: 'Lista de sublocalidades/barrios' })
  getLocationChildrens(@Query('locationId') locationId: number) {
    return this.locationsService.getLocationChildrens(locationId);
  }

  // ====== ORGANIZATION (real) ======

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Organizations')
  @ApiOperation({
    summary: 'Crear organización + sucursal + usuario admin',
    description:
      'Crea una organización con su sucursal predeterminada y un usuario administrador. ' +
      'El admin recibe un email de bienvenida para verificar su cuenta. ' +
      'Retorna los IDs de referencia para usar en endpoints de propiedades.',
  })
  @ApiResponse({ status: 201, description: 'Organización creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o email ya registrado' })
  @ApiResponse({ status: 401, description: 'API Key/Secret inválidos' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido' })
  async createOrganization(
    @Body() dto: CreateOrganizationRegistrationDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.createOrganization(dto, partner);
    return {
      success: true,
      data: result,
      message: "Organización, sucursal y usuario admin creados. El admin recibirá un email para verificar su cuenta. Conserva el branch_id retornados para referenciar la sucursal a la que pertenece la propiedad.",
    };
  }

  // ====== PROPERTY CRUD ======

  @Post('properties')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Crear propiedad (o upsert por reference_code)',
    description:
      'Crea una nueva propiedad vinculada a un branch existente. ' +
      'Si ya existe una propiedad con el mismo reference_code en la organización, se actualiza (upsert). ' +
      'Incluye soporte para videos, multimedia 360 y tags. ' +
      'Imágenes y adjuntos se gestionan mediante endpoints dedicados: POST /uploadImage y POST /uploadAttached.',
  })
  @ApiResponse({ status: 201, description: 'Propiedad creada o actualizada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Branch no encontrada' })
  async createProperty(
    @Body() dto: PartnerCreatePropertyDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.createOrUpsertProperty(dto, partner);
    return {
      success: true,
      created: result.created,
      data: result.data,
      warnings: result.warnings,
    };
  }

  @Put('properties/:referenceCode')
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Actualizar propiedad por reference_code',
    description: 'Actualiza campos escalares, operaciones y tags de una propiedad existente.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 200, description: 'Propiedad actualizada' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async updateProperty(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: PartnerUpdatePropertyDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.updateProperty(referenceCode, dto, partner);
    return {
      success: true,
      data: result.data,
      warnings: result.warnings,
    };
  }

  @Get('properties/:referenceCode')
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Obtener propiedad por reference_code',
    description: 'Retorna todos los datos de una propiedad incluyendo multimedia.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 200, description: 'Propiedad encontrada' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async getProperty(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.getProperty(referenceCode, partner);
    return { success: true, data: result.data };
  }

  @Delete('properties/:referenceCode')
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Eliminar propiedad (soft delete)',
    description: 'Marca la propiedad como eliminada. No se borra físicamente de la base de datos.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 200, description: 'Propiedad eliminada' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async deleteProperty(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.deleteProperty(referenceCode, partner);
    return { success: true, ...result };
  }

  @Post('properties/:referenceCode/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Desactivar propiedad',
    description: 'Cambia el estado de la propiedad a NO_DISPONIBLE (4).',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 200, description: 'Propiedad desactivada' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async deactivateProperty(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.deactivateProperty(referenceCode, partner);
    return { success: true, data: result.data };
  }

  // ====== IMAGES ======

  @Post('properties/:referenceCode/uploadImage')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Images')
  @ApiOperation({
    summary: 'Subir imagen a propiedad (multipart)',
    description:
      'Sube un archivo de imagen directamente a la propiedad via multipart/form-data. ' +
      'El procesamiento a S3 es fire-and-forget: retorna inmediatamente con el image_reference_id ' +
      'y upload_status=pending. Usar el image_reference_id para PATCH (metadata) o DELETE posteriores.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', nullable: true, description: 'Archivo de imagen (jpg, png, webp, etc.)' },
        description: { type: 'string', description: 'Descripción de la imagen' },
        order_position: { type: 'integer', description: 'Posición de orden (0+)' },
        is_blueprint: { type: 'string', enum: ['true', 'false'], description: 'Si es un plano de la propiedad' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagen encolada para subida. Retorna image_reference_id y upload_status=pending' })
  @ApiResponse({ status: 400, description: 'Archivo no enviado o datos inválidos' })
  @ApiResponse({ status: 403, description: 'Propiedad no pertenece a este partner' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async uploadImage(
    @Param('referenceCode') referenceCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string | undefined,
    @Body('order_position') orderPositionStr: string | undefined,
    @Body('is_blueprint') isBlueprintStr: string | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('El campo “file” es requerido');
    const partner = (request as any).partner;
    const orderPositionParsed = orderPositionStr !== undefined ? parseInt(orderPositionStr, 10) : undefined;
    const orderPosition = orderPositionParsed !== undefined && !isNaN(orderPositionParsed) ? orderPositionParsed : undefined;
    const isBlueprint = isBlueprintStr === 'true' || isBlueprintStr === '1';
    const result = await this.partnerApiService.uploadImage(
      referenceCode, file, description, orderPosition, isBlueprint, partner,
    );
    return { success: true, data: result };
  }

  @Patch('properties/:referenceCode/image/:imageReferenceCode')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Images')
  @ApiOperation({
    summary: 'Actualizar metadata o archivo de imagen',
    description:
      'Actualiza descripción, posición o flag de plano de una imagen existente. ' +
      'El campo `file` es opcional: solo debe enviarse si se desea reemplazar el archivo actual. ' +
      'Si no se quiere cambiar la imagen, no hace falta incluirlo. ' +
      'Cuando se envía, el reemplazo en S3 es fire-and-forget. ' +
      'Usa el image_reference_id retornado al subir.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'imageReferenceCode', description: 'ID de referencia de la imagen (retornado en uploadImage)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', nullable: true, description: 'Nuevo archivo de imagen — SOLO enviar si se quiere reemplazar la imagen. Si no se desea cambiarla, omitir este campo.' },
        description: { type: 'string', description: 'Descripción de la imagen' },
        order_position: { type: 'integer', description: 'Posición de orden (0+)' },
        is_blueprint: { type: 'string', enum: ['true', 'false'], description: 'Si es un plano de la propiedad' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Metadata actualizada' })
  @ApiResponse({ status: 404, description: 'Imagen o propiedad no encontrada' })
  async patchImage(
    @Param('referenceCode') referenceCode: string,
    @Param('imageReferenceCode', ParseIntPipe) imageId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })) dto: PartnerPatchImageDto,
    @Req() request: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.patchImage(referenceCode, imageId, dto, partner, file);
    return { success: true, data: result };
  }

  @Delete('properties/:referenceCode/image/:imageReferenceCode')
  @ApiTags('Images')
  @ApiOperation({
    summary: 'Eliminar imagen de propiedad',
    description: 'Elimina una imagen usando su image_reference_id.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'imageReferenceCode', description: 'ID de referencia de la imagen' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen o propiedad no encontrada' })
  async removeImage(
    @Param('referenceCode') referenceCode: string,
    @Param('imageReferenceCode', ParseIntPipe) imageId: number,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.removeImage(referenceCode, imageId, partner);
    return { success: true, ...result };
  }

  // ====== ATTACHED FILES ======

  @Post('properties/:referenceCode/uploadAttached')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Attached')
  @ApiOperation({
    summary: 'Subir adjunto a propiedad (multipart)',
    description:
      'Sube un archivo adjunto directamente a la propiedad via multipart/form-data. ' +
      'El procesamiento a S3 es fire-and-forget: retorna inmediatamente con el attached_reference_id ' +
      'y upload_status=pending. Usar el attached_reference_id para PATCH (metadata) o DELETE posteriores.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo adjunto (pdf, doc, xls, etc.)' },
        description: { type: 'string', description: 'Descripción del adjunto' },
        order: { type: 'integer', description: 'Posición de orden (0+)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Adjunto encolado para subida. Retorna attached_reference_id y upload_status=pending' })
  @ApiResponse({ status: 400, description: 'Archivo no enviado o datos inválidos' })
  @ApiResponse({ status: 403, description: 'Propiedad no pertenece a este partner' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async uploadAttached(
    @Param('referenceCode') referenceCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string | undefined,
    @Body('order') orderStr: string | undefined,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('El campo “file” es requerido');
    const partner = (request as any).partner;
    const orderParsed = orderStr !== undefined ? parseInt(orderStr, 10) : undefined;
    const order = orderParsed !== undefined && !isNaN(orderParsed) ? orderParsed : undefined;
    const result = await this.partnerApiService.uploadAttached(
      referenceCode, file, description, order, partner,
    );
    return { success: true, data: result };
  }

  @Patch('properties/:referenceCode/attached/:attachedReferenceCode')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiTags('Attached')
  @ApiOperation({
    summary: 'Actualizar metadata o archivo de adjunto',
    description:
      'Actualiza descripción u orden de un adjunto existente. ' +
      'El campo `file` es opcional: solo debe enviarse si se desea reemplazar el archivo actual. ' +
      'Si no se quiere cambiar el adjunto, no hace falta incluirlo. ' +
      'Cuando se envía, el reemplazo en S3 es fire-and-forget. ' +
      'Usa el attached_reference_id retornado al subir.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'attachedReferenceCode', description: 'ID de referencia del adjunto (retornado en uploadAttached)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', nullable: true, description: 'Nuevo archivo adjunto — SOLO enviar si se quiere reemplazar el archivo. Si no se desea cambiarlo, omitir este campo.' },
        description: { type: 'string', description: 'Descripción del adjunto' },
        order: { type: 'integer', description: 'Posición de orden (0+)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Metadata actualizada' })
  @ApiResponse({ status: 404, description: 'Adjunto o propiedad no encontrada' })
  async patchAttached(
    @Param('referenceCode') referenceCode: string,
    @Param('attachedReferenceCode', ParseIntPipe) attachedId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })) dto: PartnerPatchAttachedDto,
    @Req() request: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.patchAttached(referenceCode, attachedId, dto, partner, file);
    return { success: true, data: result };
  }

  @Delete('properties/:referenceCode/attached/:attachedReferenceCode')
  @ApiTags('Attached')
  @ApiOperation({
    summary: 'Eliminar adjunto de propiedad',
    description: 'Elimina un adjunto usando su attached_reference_id.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'attachedReferenceCode', description: 'ID de referencia del adjunto' })
  @ApiResponse({ status: 200, description: 'Adjunto eliminado' })
  @ApiResponse({ status: 404, description: 'Adjunto o propiedad no encontrada' })
  async removeAttached(
    @Param('referenceCode') referenceCode: string,
    @Param('attachedReferenceCode', ParseIntPipe) attachedId: number,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.removeAttached(referenceCode, attachedId, partner);
    return { success: true, ...result };
  }

  @Post('properties/:referenceCode/retry-uploads')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiTags('Properties')
  @ApiOperation({
    summary: 'Reintentar uploads fallidos de multimedia',
    description: 'Reintenta subir a S3 todos los archivos (imágenes y adjuntos) que fallaron previamente para una propiedad específica del partner.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 202, description: 'Reintentos en progreso' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async retryFailedUploads(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.retryFailedUploadsForPartner(referenceCode, partner);
    return result;
  }
}