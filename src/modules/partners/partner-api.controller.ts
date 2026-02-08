import { Controller, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../../common/guards/api-key-auth.guard';
import { Request } from 'express';

@Controller('api/partner/v1')
@UseGuards(ApiKeyAuthGuard)
export class PartnerApiController {

  @Post('properties')
  async createProperty(@Body() body: any, @Req() request: Request) {
    const partner = (request as any).partner;
    
    return {
      action: 'CREATE_PROPERTY',
      partner_id: partner.id,
      partner_name: partner.name,
      body: body,
      timestamp: new Date().toISOString()
    };
  }

  @Put('properties/:id')
  async updateProperty(@Param('id') id: string, @Body() body: any, @Req() request: Request) {
    const partner = (request as any).partner;
    
    return {
      action: 'UPDATE_PROPERTY',
      property_id: id,
      partner_id: partner.id,
      partner_name: partner.name,
      body: body,
      timestamp: new Date().toISOString()
    };
  }

  @Delete('properties/:id')
  async deleteProperty(@Param('id') id: string, @Body() body: any, @Req() request: Request) {
    const partner = (request as any).partner;
    
    return {
      action: 'DELETE_PROPERTY',
      property_id: id,
      partner_id: partner.id,
      partner_name: partner.name,
      body: body,
      timestamp: new Date().toISOString()
    };
  }

  @Post('properties/:id/deactivate')
  async deactivateProperty(@Param('id') id: string, @Body() body: any, @Req() request: Request) {
    const partner = (request as any).partner;
    
    return {
      action: 'DEACTIVATE_PROPERTY',
      property_id: id,
      partner_id: partner.id,
      partner_name: partner.name,
      body: body,
      timestamp: new Date().toISOString()
    };
  }
}