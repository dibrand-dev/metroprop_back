import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateBranchPlanDto } from './dto/create-branch-plan.dto';
import { CreateUserPlanDto } from './dto/create-user-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER_ROL_SUPER_ADMIN)
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
  ) {}

  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  // ─── Branch-plan routes (static segments before dynamic :id) ──────────────

  @Get('branch/:branchId')
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  getBranchPlans(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Request() req: any,
  ) {
    return this.plansService.getBranchPlans(branchId, req.user);
  }

  @Post('branch/:branchId')
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  async createBranchPlan(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Body() dto: CreateBranchPlanDto,
    @Request() req: any,
  ) {
    return this.plansService.createBranchPlan(dto, req.user, branchId);
  }

  // ─── User-plan routes ─────────────────────────────────────────────────────

  @Get('user/:userId')
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  getUserPlans(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    return this.plansService.getUserPlans(userId, req.user);
  }

  @Post('user/:userId')
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  createUserPlan(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateUserPlanDto,
    @Request() req: any,
  ) {
    return this.plansService.createUserPlan(dto, req.user, userId);
  }

  // ─── Dynamic :id routes ───────────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':planId/end')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  endBranchPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Request() req: any,
  ) {
    return this.plansService.endBranchPlan(planId, req.user);
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.disable(id);
  }

  

  @Patch(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.enable(id);
  }


  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}
