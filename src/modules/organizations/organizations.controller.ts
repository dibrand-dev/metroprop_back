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
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationFiltersDto } from './dto/organization-filters.dto';

@Controller('organizations')
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
  create(@Body() data: CreateOrganizationDto) {
    return this.organizationsService.create(data);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() data: UpdateOrganizationDto
  ) {
    return this.organizationsService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.organizationsService.remove(id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(@Param('id', ParseIntPipe) id: number) {
    const org = await this.organizationsService.disable(id);
    return {
      message: 'Organización deshabilitada correctamente',
      data: org,
    };
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  async enable(@Param('id', ParseIntPipe) id: number) {
    const org = await this.organizationsService.enable(id);
    return {
      message: 'Organización habilitada correctamente',
      data: org,
    };
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Chequear existencia de la organización antes de subir
    const org = await this.organizationsService.findOne(id);
    if (!org) {
      return {
        statusCode: 404,
        message: `Organization with id ${id} not found. No upload performed.`
      };
    }

    // Upload a S3
    const imageUrl = await this.organizationsService.uploadLogoToS3(file, id);

    // Actualizar el company_logo de la organización en la DB solo si subió bien
    if (imageUrl) {
      await this.organizationsService.update(id, { company_logo: imageUrl } as any);
    }

    return {
      message: imageUrl ? 'Logo uploaded successfully' : 'Logo upload failed',
      imageUrl: imageUrl,
      organizationId: id,
      fileSize: file.size,
      fileName: file.originalname,
      logo_status: imageUrl ? null : 'Ver campo logo_status en la entidad para detalles de error',
    };
  }
}