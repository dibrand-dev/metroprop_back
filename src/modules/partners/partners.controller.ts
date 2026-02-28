import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';  
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
  Query,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('checkstatus')
  checkStatus() {
    return 'hola';
  }


  @Get()
  findAll(
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.partnersService.findAll(parseInt(limit), parseInt(offset));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partnersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    return this.partnersService.update(id, updatePartnerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.partnersService.remove(id);
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Chequear existencia del partner antes de subir
    const partner = await this.partnersService.findById(id);
    if (!partner) {
      return {
        statusCode: 404,
        message: `Partner with id ${id} not found. No upload performed.`
      };
    }

    // Upload a S3
    const imageUrl = await this.partnersService.uploadImageToS3(file, id);

    // Actualizar el campo image en la DB solo si subió bien
    if (imageUrl) {
      await this.partnersService.update(id, { image: imageUrl } as any);
    }

    return {
      message: imageUrl ? 'Image uploaded successfully' : 'Image upload failed',
      imageUrl: imageUrl,
      partnerId: id,
    };
  }
}
