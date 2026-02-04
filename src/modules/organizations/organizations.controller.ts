import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';

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
  create(@Body() data: Partial<Organization>) {
    return this.organizationsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<Organization>) {
    return this.organizationsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.organizationsService.remove(id);
  }
}