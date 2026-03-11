import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.branchesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateBranchDto) {
    return this.branchesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: UpdateBranchDto) {
    return this.branchesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.branchesService.remove(id);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Chequear existencia del branch antes de subir
    const branch = await this.branchesService.findOne(id);
    if (!branch) {
      return {
        statusCode: 404,
        message: `Branch with id ${id} not found. No upload performed.`
      };
    }

    // Upload a S3
    const imageUrl = await this.branchesService.uploadLogoToS3(file, id);

    // Actualizar el campo branch_logo en la DB solo si subió bien
    if (imageUrl) {
      await this.branchesService.update(id, { branch_logo: imageUrl } as any);
    }

    return {
      message: imageUrl ? 'Logo uploaded successfully' : 'Logo upload failed',
      imageUrl: imageUrl,
      branchId: id,
    };
  }
}