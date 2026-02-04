import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permission } from './entities/permission.entity';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<Permission>) {
    return this.permissionsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<Permission>) {
    return this.permissionsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.permissionsService.remove(id);
  }
}