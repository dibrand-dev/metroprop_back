import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { PartnerApiService } from './partner-api.service';
import { PartnerCreateOrganizationDto } from './dto/partner-create-organization.dto';
import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerAddImagesDto } from './dto/partner-add-images.dto';
import { PartnerAddAttachedDto } from './dto/partner-add-attached.dto';
import { Request } from 'express';

@Controller('api/partner/v1')
@UseGuards(ThrottlerGuard, ApiKeyAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 100 } })
@ApiSecurity('x-api-key')
@ApiSecurity('x-api-secret')
export class PartnerApiController {
  constructor(private readonly partnerApiService: PartnerApiService) {}

  // ====== ORGANIZATION ======

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
    @Body() dto: PartnerCreateOrganizationDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.createOrganization(dto, partner);
    return {
      success: true,
      data: result,
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
      'Incluye soporte para imágenes, videos, multimedia 360, adjuntos y tags.',
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

  @Post('properties/:referenceCode/images')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Images')
  @ApiOperation({
    summary: 'Agregar imágenes a propiedad',
    description:
      'Agrega una o más imágenes a la propiedad. Las imágenes se procesan en background (fire-and-forget) ' +
      'y se suben a S3 automáticamente.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 201, description: 'Imágenes agregadas' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async addImages(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: PartnerAddImagesDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.addImages(referenceCode, dto, partner);
    return { success: true, ...result };
  }

  @Delete('properties/:referenceCode/images/:imageId')
  @ApiTags('Images')
  @ApiOperation({
    summary: 'Eliminar imagen de propiedad',
    description: 'Elimina una imagen específica por su ID.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'imageId', description: 'ID de la imagen a eliminar' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen o propiedad no encontrada' })
  async removeImage(
    @Param('referenceCode') referenceCode: string,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.removeImage(referenceCode, imageId, partner);
    return { success: true, ...result };
  }

  // ====== ATTACHED FILES ======

  @Post('properties/:referenceCode/attached')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('Attached')
  @ApiOperation({
    summary: 'Agregar archivos adjuntos a propiedad',
    description: 'Agrega archivos adjuntos (PDFs, documentos, etc.) a la propiedad.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiResponse({ status: 201, description: 'Adjuntos agregados' })
  @ApiResponse({ status: 404, description: 'Propiedad no encontrada' })
  async addAttached(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: PartnerAddAttachedDto,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.addAttached(referenceCode, dto, partner);
    return { success: true, ...result };
  }

  @Delete('properties/:referenceCode/attached/:attachedId')
  @ApiTags('Attached')
  @ApiOperation({
    summary: 'Eliminar adjunto de propiedad',
    description: 'Elimina un archivo adjunto específico por su ID.',
  })
  @ApiParam({ name: 'referenceCode', description: 'Código de referencia de la propiedad' })
  @ApiParam({ name: 'attachedId', description: 'ID del adjunto a eliminar' })
  @ApiResponse({ status: 200, description: 'Adjunto eliminado' })
  @ApiResponse({ status: 404, description: 'Adjunto o propiedad no encontrada' })
  async removeAttached(
    @Param('referenceCode') referenceCode: string,
    @Param('attachedId', ParseIntPipe) attachedId: number,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.removeAttached(referenceCode, attachedId, partner);
    return { success: true, ...result };
  }
}