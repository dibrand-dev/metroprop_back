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
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { PartnerApiService } from './partner-api.service';
import { PartnerCreatePropertyDto } from './dto/partner-create-property.dto';
import { PartnerUpdatePropertyDto } from './dto/partner-update-property.dto';
import { PartnerAddImagesDto } from './dto/partner-add-images.dto';
import { PartnerAddAttachedDto } from './dto/partner-add-attached.dto';
import { Request } from 'express';

@Controller('api/partner/v1')
@UseGuards(ThrottlerGuard, ApiKeyAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 100 } })
export class PartnerApiController {
  constructor(private readonly partnerApiService: PartnerApiService) {}

  // ====== PROPERTY CRUD ======

  @Post('properties')
  @HttpCode(HttpStatus.CREATED)
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
  async getProperty(
    @Param('referenceCode') referenceCode: string,
    @Req() request: Request,
  ) {
    const partner = (request as any).partner;
    const result = await this.partnerApiService.getProperty(referenceCode, partner);
    return { success: true, data: result.data };
  }

  @Delete('properties/:referenceCode')
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