import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Param, 
  Body,
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

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAll();
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