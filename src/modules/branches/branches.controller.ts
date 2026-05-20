import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, Patch, Request, ForbiddenException, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { PlansService } from '../plans/plans.service';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly plansService: PlansService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  findAll() {
    return this.branchesService.findAll();
  }

  // get all branches by organization id
  @Get('organization/:orgId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_COLLABORATOR, UserRole.USER_ROL_SUPERVISOR)
  getByOrganization(@Request() req: any, @Param('orgId') orgId: number) {
    if (
      req.user.role_id !== UserRole.USER_ROL_SUPER_ADMIN &&
      req.user.organization_id !== Number(orgId)
    ) {
      throw new ForbiddenException('No tienes permisos para acceder a esta organización');
    }

    return this.branchesService.getByOrganization(orgId);
  }

  @Get(':id/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  getBranchPlans(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.plansService.getBranchPlans(id, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  findOne(@Param('id') id: number) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  @UseInterceptors(FileInterceptor('branch_logo', { storage: undefined }))
  create(
    @Body() data: CreateBranchDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.branchesService.create(data, file);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
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
}