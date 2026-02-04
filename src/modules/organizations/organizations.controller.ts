import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateOrganizationDto) {
    return this.organizationsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: UpdateOrganizationDto) {
    return this.organizationsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.organizationsService.remove(id);
  }
}