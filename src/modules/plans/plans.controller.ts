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
  ForbiddenException,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanPaymentDto } from './dto/mercadopago-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.plansService.findAll();
  }

  // ─── Branch-plan routes (static segments before dynamic :id) ──────────────

  @Get('branch/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  getBranchPlans(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Request() req: any,
  ) {
    return this.plansService.getBranchPlans(branchId, req.user);
  }

  @Post('branch/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  async createBranchPlan(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Body() dto: PlanPaymentDto,
    @Request() req: any,
  ) {
    return this.plansService.createBranchPlan(dto, req.user, branchId);
  }

  // ─── User-plan routes ─────────────────────────────────────────────────────

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  getUserPlans(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    const requester = req.user;
    const isAdmin =
      requester.role_id === UserRole.USER_ROL_SUPER_ADMIN ||
      requester.role_id === UserRole.USER_ROL_ADMIN;

    if (!isAdmin && requester.id !== userId) {
      throw new ForbiddenException('No tenés permiso para acceder a este recurso');
    }

    return this.plansService.getUserPlans(userId, req.user);
  }

  @Post('user/:userId')
  @UseGuards(JwtAuthGuard)
  createUserPlan(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: PlanPaymentDto,
    @Request() req: any,
  ) {
    const requester = req.user;
    const isAdmin =
      requester.role_id === UserRole.USER_ROL_SUPER_ADMIN ||
      requester.role_id === UserRole.USER_ROL_ADMIN;

    if (!isAdmin && requester.id !== userId) {
      throw new ForbiddenException('No tenés permiso para acceder a este recurso');
    }

    return this.plansService.createUserPlan(dto, req.user, userId);
  }

  // ─── Dynamic :id routes ───────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':planId/end')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  endBranchPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Request() req: any,
  ) {
    return this.plansService.endBranchPlan(planId, req.user);
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.disable(id);
  }

  

  @Patch(':id/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_ADMIN)
  enable(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.enable(id);
  }


  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}
