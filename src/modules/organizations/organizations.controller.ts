import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Param, 
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationFiltersDto } from './dto/organization-filters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async findAll(@Query() filters: OrganizationFiltersDto) {
    const result = await this.organizationsService.findAll(filters);
    return {
      data: result.data,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('company_logo', { storage: undefined }))
  create(
    @Body() data: CreateOrganizationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.organizationsService.create(data, file);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('company_logo', { storage: undefined }))
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() data: UpdateOrganizationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.organizationsService.update(id, data, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.organizationsService.remove(id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  async disable(@Param('id', ParseIntPipe) id: number) {
    const org = await this.organizationsService.disable(id);
    return {
      message: 'Organización deshabilitada correctamente',
      data: org,
    };
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  async enable(@Param('id', ParseIntPipe) id: number) {
    const org = await this.organizationsService.enable(id);
    return {
      message: 'Organización habilitada correctamente',
      data: org,
    };
  }

}