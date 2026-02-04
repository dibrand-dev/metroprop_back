import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.rolesService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<Role>) {
    return this.rolesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<Role>) {
    return this.rolesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.rolesService.remove(id);
  }
}