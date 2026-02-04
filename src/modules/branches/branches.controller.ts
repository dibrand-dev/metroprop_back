import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Branch } from './entities/branch.entity';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.branchesService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<Branch>) {
    return this.branchesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<Branch>) {
    return this.branchesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.branchesService.remove(id);
  }
}