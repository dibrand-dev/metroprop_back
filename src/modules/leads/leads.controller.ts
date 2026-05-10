import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { UserRole } from '@/common/enums';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}
 
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SELLER)
  findAll(@Query() filters: LeadFiltersDto, @Req() request: Request) {

    if ((request as any).user.role_id !== UserRole.USER_ROL_SUPER_ADMIN) {
      if((request as any).user.organization_id !== undefined) {
        filters.organization_id = (request as any).user.organization_id;
      } else {
        filters.owner_user_id = (request as any).user.id;
      }
    }

    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_ADMIN, UserRole.USER_ROL_SUPER_ADMIN, UserRole.USER_ROL_SELLER)
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

  @Put(':id')
  @UseInterceptors(NoFilesInterceptor())
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeadDto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, updateLeadDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.remove(id);
  }
 

  // get all leads by property id
  @Get('property/:propertyId')
  findAllByProperty(@Param('propertyId', ParseIntPipe) propertyId: number) {
    return this.leadsService.findAll({ property_id: propertyId });
  }

  // get all leads by email @Get('email/:email')
  findAllByEmail(@Param('email') email: string) {
    return this.leadsService.findAll({ email });
  }

}