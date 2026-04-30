import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Patch } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  findOne(@Param('id') id: number) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('branch_logo', { storage: undefined }))
  create(
    @Body() data: CreateBranchDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.branchesService.create(data, file);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('branch_logo', { storage: undefined }))
  update(
    @Param('id') id: number,
    @Body() data: UpdateBranchDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.branchesService.update(id, data, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  remove(@Param('id') id: number) {
    return this.branchesService.remove(id);
  }

  // get all branches by organization id
  @Get('organization/:orgId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  getByOrganization(@Param('orgId') orgId: number) {
    return this.branchesService.getByOrganization(orgId); 
  }
}