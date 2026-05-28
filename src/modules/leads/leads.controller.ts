import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { UserRole } from '@/common/enums';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}
 
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SUPERVISOR)
  findAll(@Query() filters: LeadFiltersDto, @Req() request: Request) {
    const user = (request as any).user;

    if (user.role_id === UserRole.USER_ROL_SUPER_ADMIN) {
      // ve todo
    } else if ((user.role_id === UserRole.USER_ROL_ADMIN || user.role_id === UserRole.USER_ROL_SUPERVISOR) && user.organization_id !== undefined) {
      filters.organization_id = user.organization_id;
    } else {
      // SELLER o ADMIN sin org → solo sus propios leads
      filters.owner_user_id = user.id;
    }

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
    @Req() request: Request,
  ) {
    const user = (request as any).user;
    const filters: LeadFiltersDto = {};

    if (propertyIdRaw !== undefined) filters.property_id = parseInt(propertyIdRaw, 10);
    if (email) filters.email = email;
    if (offsetRaw !== undefined) filters.offset = parseInt(offsetRaw, 10);
    if (limitRaw !== undefined) filters.limit = parseInt(limitRaw, 10);

    if (user.role_id === UserRole.USER_ROL_SUPER_ADMIN) {
      // ve todo
    } else if (user.role_id === UserRole.USER_ROL_ADMIN && user.organization_id !== undefined) {
      filters.organization_id = user.organization_id;
    } else {
      filters.owner_user_id = user.id;
    }

    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SUPERVISOR)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    let  lead = await this.leadsService.findOne(id);
    if (lead && ((request as any).user.role_id === UserRole.USER_ROL_SUPER_ADMIN || 
      ((request as any).user.organization_id !== undefined && lead.organization_id == (request as any).user.organization_id) || 
        (lead.owner_user_id == (request as any).user.id))) {
      return lead;
    }
    return null;
  }

  @Post()
  @UseInterceptors(NoFilesInterceptor())
  create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }
/*
  @Put(':id')
  @UseInterceptors(NoFilesInterceptor())
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeadDto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, updateLeadDto);
  }
*/
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    let  lead = await this.leadsService.findOne(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if ((request as any).user.role_id === UserRole.USER_ROL_SUPER_ADMIN || 
      ((request as any).user.organization_id !== undefined && lead.organization_id == (request as any).user.organization_id) || 
        (lead.owner_user_id == (request as any).user.id)) {
          return this.leadsService.remove(id);
    } 
    return false;
  }


}