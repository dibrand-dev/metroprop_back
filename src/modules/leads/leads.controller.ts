import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadPropertyDto } from './dto/update-lead-property.dto';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { LeadState, UserRole } from '@/common/enums';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  private assertLeadAccess(user: any, lead: { organization_id?: number; owner_user_id?: number }): void {
    if (user.role_id === UserRole.USER_ROL_SUPER_ADMIN) return;
    if (user.organization_id !== undefined && lead.organization_id == user.organization_id) return;
    if (lead.owner_user_id == user.id) return;
    throw new ForbiddenException('No tenés permiso para acceder a este lead');
  }

  private applyLeadScope(user: any, filters: LeadFiltersDto): void {
    if (user.role_id === UserRole.USER_ROL_SUPER_ADMIN) return;

    if (
      (user.role_id === UserRole.USER_ROL_ADMIN || user.role_id === UserRole.USER_ROL_SUPERVISOR) &&
      user.organization_id !== undefined
    ) {
      filters.organization_id = user.organization_id;
      return;
    }

    filters.owner_user_id = user.id;
  }
 
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SUPERVISOR)
  findAll(@Query() filters: LeadFiltersDto, @Req() request: Request) {
    this.applyLeadScope((request as any).user, filters);
    return this.leadsService.findAll(filters);
  }

  // get all leads by email of the authenticated user
  @UseGuards(JwtAuthGuard)
  @Get('my-contacts')
  findMyContacts(@Req() request: Request) {
    const user = (request as any).user;
    return this.leadsService.getLeadProperties({ email: user.email });
  }

  // search leads by property_id and/or lead email
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  @Get('search')
  findFiltered(
    @Query('property_id') propertyIdRaw: string | undefined,
    @Query('email') email: string | undefined,
    @Query('offset') offsetRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('deleted') deletedRaw: string | undefined,
    @Query('highlighted') highlightedRaw: string | undefined,
    @Query('blocked') blockedRaw: string | undefined,
    @Query('unread') unreadRaw: string | undefined,
    @Query('lead_state') leadStateRaw: string | undefined,
    @Req() request: Request,
  ) {
    const user = (request as any).user;
    const filters: LeadFiltersDto = {};

    if (propertyIdRaw !== undefined) filters.property_id = parseInt(propertyIdRaw, 10);
    if (email) filters.email = email;
    if (offsetRaw !== undefined) filters.offset = parseInt(offsetRaw, 10);
    if (limitRaw !== undefined) filters.limit = parseInt(limitRaw, 10);
    if (deletedRaw !== undefined) filters.deleted = deletedRaw === 'true';
    if (highlightedRaw !== undefined) filters.highlighted = highlightedRaw === 'true';
    if (blockedRaw !== undefined) filters.blocked = blockedRaw === 'true';
    if (unreadRaw !== undefined) filters.unread = unreadRaw === 'true';
    if (leadStateRaw !== undefined && Object.values(LeadState).includes(leadStateRaw as LeadState)) {
      filters.lead_state = leadStateRaw as LeadState;
    }

    this.applyLeadScope(user, filters);

    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_COLLABORATOR, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SUPERVISOR)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const lead = await this.leadsService.findOne(id);
    this.assertLeadAccess((request as any).user, lead);
    return lead;
  }

  @Post()
  @UseInterceptors(NoFilesInterceptor())
  create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('lead-property/:id')
  async updateLeadProperty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadPropertyDto,
    @Req() request: Request,
  ) {
    const leadProperty = await this.leadsService.findLeadPropertyWithLead(id);
    this.assertLeadAccess((request as any).user, leadProperty.lead!);
    return this.leadsService.updateLeadProperty(leadProperty, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const lead = await this.leadsService.findOne(id);
    this.assertLeadAccess((request as any).user, lead);
    return this.leadsService.remove(id);
  }


}