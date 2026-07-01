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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdsBannersService } from './ads-banners.service';
import { CreateAdsBannerDto } from './dto/create-ads-banner.dto';
import { UpdateAdsBannerDto } from './dto/update-ads-banner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('ads-banners')
export class AdsBannersController {
  constructor(private readonly adsBannersService: AdsBannersService) {}

  @Get()
  findAll() {
    return this.adsBannersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adsBannersService.findOne(id);
  }

  @Post()
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  create(
    @Body() dto: CreateAdsBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsBannersService.create(dto, file);
  }

  @Patch(':id')
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdsBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsBannersService.update(id, dto, file);
  }

  @Patch(':id/disable')
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.adsBannersService.disable(id);
  }

  @Delete(':id')
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adsBannersService.remove(id);
  }
}
