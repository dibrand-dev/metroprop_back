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
  HttpCode,
  HttpStatus,  
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { PartnerApiService } from './partner-api.service';
import { LocationsService } from '../locations/locations.service';
import { CreateOrganizationRegistrationDto } from '../registration/dto/create-organization-registration.dto';
import { Request } from 'express';
import { CreatePropertyDto } from '../properties/dto/create-property.dto';
import { UpdatePropertyDto } from '../properties/dto/update-property.dto';
import { CreateDevelopmentDto } from '../properties/dto/create-development.dto';
import { UpdateDevelopmentDto } from '../properties/dto/update-development.dto';
import { CreateDevelopmentUnitDto } from '../properties/dto/create-development-unit.dto';
import { UpdateDevelopmentUnitDto } from '../properties/dto/update-development-unit.dto';

@Controller('api/partner/v1')
@UseGuards(ThrottlerGuard, ApiKeyAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 100 } })
@ApiSecurity('x-api-key')
@ApiSecurity('x-api-secret')
export class PartnerApiController {
  private readonly logger = new Logger(PartnerApiController.name);

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
    dto.admin_is_verified = true; 
    const result = await this.partnerApiService.createOrganization(dto, partner);
    return {
      success: true,
      data: result,
      message: "Organización, sucursal y usuario admin creados. El admin recibirá un email de bienvenida. Conserva el branch_id retornados para referenciar la sucursal a la que pertenece la propiedad.",
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
      'Ahora soporta imágenes y adjuntos directamente en el payload, además de videos, multimedia 360 y tags.\n' +
      'Ejemplo de payload:\n' +
      '{\n' +
      '  "reference_code": "ABC123",\n' +
      '  "branch_reference_id": 1,\n' +
      '  "videos": [ { "url": "https://video.com/1.mp4" } ],\n' +
      '  "multimedia360": [ { "url": "https://360.com/1" } ],\n' +
      '  "tags": [1,2],\n' +
      '  "images": [\n' +
      '    { "url": "https://www.imagen.com/123.webp", "description": "no obligatoria description" },\n' +
      '    { "url": "https://www.imagen.com/456.jpg" }\n' +
      '  ],\n' +
      '  "attached": [\n' +
      '    { "url": "https://www.pdffile.com/plano2.pdf" }\n' +
      '  ]\n' +
      '}',
  })
  @ApiResponse({ status: 201, description: 'Propiedad creada o actualizada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Branch no encontrada' })
  async createProperty(
    @Body() dto: CreatePropertyDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.createOrUpsertProperty(dto, partner);
    this.logger?.log?.('[Controller] RESULT createOrUpsertProperty', JSON.stringify(result, null, 2));
    console.log('[Controller] RESULT createOrUpsertProperty', JSON.stringify(result, null, 2));
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
    @Body() dto: UpdatePropertyDto,
    @Req() request: Request,
  ) {
    this.logger?.log?.('[Controller] INICIO updateProperty');
    console.log('[Controller] INICIO updateProperty');
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
    const result = await this.partnerApiService.resetFailedUploadsForPartner(referenceCode, partner);
    return result;
  }

  // ====== DEVELOPMENTS ======

  @Post('developments')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Crear emprendimiento (o upsert por reference_code)',
    description:
      'Crea un nuevo emprendimiento vinculado a un branch existente. ' +
      'Si ya existe un emprendimiento con el mismo reference_code en la organización, se actualiza (upsert). ' +
      'Soporta imágenes, adjuntos, videos, multimedia 360 y tags en el payload.',
  })
  @ApiResponse({ status: 201, description: 'Emprendimiento creado o actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Branch no encontrada' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido' })
  async createDevelopment(
    @Body() dto: CreateDevelopmentDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.createOrUpsertDevelopment(dto, partner);
    return {
      success: true,
      created: result.created,
      data: result.data,
      warnings: result.warnings,
    };
  }

  @Get('developments/:referenceCode')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Obtener emprendimiento por reference_code',
    description: 'Retorna todos los datos de un emprendimiento incluyendo multimedia.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento' })
  @ApiResponse({ status: 200, description: 'Emprendimiento encontrado' })
  @ApiResponse({ status: 404, description: 'Emprendimiento no encontrado' })
  async getDevelopment(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.getDevelopment(referenceCode, partner);
    return { success: true, data: result.data };
  }

  @Put('developments/:referenceCode')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Actualizar emprendimiento por reference_code',
    description: 'Actualiza campos escalares, multimedia y tags de un emprendimiento existente.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento' })
  @ApiResponse({ status: 200, description: 'Emprendimiento actualizado' })
  @ApiResponse({ status: 404, description: 'Emprendimiento no encontrado' })
  async updateDevelopment(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateDevelopmentDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.updateDevelopment(referenceCode, dto, partner);
    return {
      success: true,
      data: result.data,
      warnings: result.warnings,
    };
  }

  @Delete('developments/:referenceCode')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Eliminar emprendimiento (soft delete)',
    description: 'Marca el emprendimiento como eliminado. No se borra físicamente de la base de datos.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento' })
  @ApiResponse({ status: 200, description: 'Emprendimiento eliminado' })
  @ApiResponse({ status: 404, description: 'Emprendimiento no encontrado' })
  async deleteDevelopment(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.deleteDevelopment(referenceCode, partner);
    return { success: true, ...result };
  }

  // ====== DEVELOPMENT UNITS ======

  @Post('developments/:referenceCode/units')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Crear / actualizar (upsert) unidad en un emprendimiento',
    description:
      'Crea una unidad (propiedad hija) vinculada al emprendimiento indicado por reference_code. ' +
      'Si ya existe una unidad con el mismo reference_code bajo ese emprendimiento se actualiza (upsert). ' +
      'El servidor asigna automáticamente development_id, organization_id y branch_id del emprendimiento padre. ' +
      'Acepta los mismos campos que una propiedad regular (imágenes, videos, tags, adjuntos).',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento padre' })
  @ApiResponse({ status: 201, description: 'Unidad creada o actualizada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Emprendimiento no encontrado' })
  async addUnitToDevelopment(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: CreateDevelopmentUnitDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.addOrUpsertUnitToDevelopment(referenceCode, dto, partner);
    return {
      success: true,
      created: result.created,
      data: result.data,
      warnings: result.warnings,
    };
  }

  @Get('developments/:referenceCode/units')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Listar unidades de un emprendimiento',
    description: 'Retorna todas las unidades (propiedades hijas) activas del emprendimiento.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento padre' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  @ApiResponse({ status: 404, description: 'Emprendimiento no encontrado' })
  async getUnitsForDevelopment(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.getUnitsForDevelopment(referenceCode, partner);
    return { success: true, total: result.total, data: result.data };
  }

  @Put('developments/:referenceCode/units/:unitRefCode')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Actualizar unidad de un emprendimiento',
    description: 'Actualiza campos de una unidad existente. Solo enviar los campos que se desean modificar.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento padre' })
  @ApiParam({ name: 'unitRefCode', description: 'Código de referencia de la unidad' })
  @ApiResponse({ status: 200, description: 'Unidad actualizada' })
  @ApiResponse({ status: 404, description: 'Emprendimiento o unidad no encontrados' })
  async updateDevelopmentUnit(
    @Param('referenceCode') referenceCode: string,
    @Param('unitRefCode') unitRefCode: string,
    @Body() dto: UpdateDevelopmentUnitDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.updateDevelopmentUnit(referenceCode, unitRefCode, dto, partner);
    return { success: true, data: result.data, warnings: result.warnings };
  }

  @Delete('developments/:referenceCode/units/:unitRefCode')
  @ApiTags('Developments')
  @ApiOperation({
    summary: 'Eliminar unidad de un emprendimiento (soft delete)',
    description: 'Marca la unidad como eliminada. No se borra físicamente de la base de datos.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia del emprendimiento padre' })
  @ApiParam({ name: 'unitRefCode', description: 'Código de referencia de la unidad' })
  @ApiResponse({ status: 200, description: 'Unidad eliminada' })
  @ApiResponse({ status: 404, description: 'Emprendimiento o unidad no encontrados' })
  async deleteDevelopmentUnit(
    @Param('referenceCode') referenceCode: string,
    @Param('unitRefCode') unitRefCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.deleteDevelopmentUnit(referenceCode, unitRefCode, partner);
    return { success: true, ...result };
  }
}