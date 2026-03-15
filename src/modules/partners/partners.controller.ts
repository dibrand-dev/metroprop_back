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
import { ApiExcludeController } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { PartnerApiService } from './partner-api.service';
import { BranchesService } from '../branches/branches.service';
import { UsersService } from '../users/users.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { TokkoHelperService } from '../../common/helpers/tokko-helper';
import { UserRole } from '@/common/enums';

@ApiExcludeController()
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly partnerApiService: PartnerApiService,
    private readonly branchesService: BranchesService,
    private readonly usersService: UsersService,
    private readonly tokkoHelperService: TokkoHelperService,
  ) {}

  @Get('checkstatus')
  checkStatus() {
    return 'hola';
  }

  /**
   * GET /partners/organization-properties-tokko?apikey=xxx&limit=20&offset=0
   * Obtener y procesar propiedades de una organización desde Tokko con paginación
   */
  @Get('organization-properties-tokko')
  async getOrganizationPropertiesTokko(
    @Query('apikey') apikey: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    if (!apikey) {
      return {
        error: 'API key is required',
        received: apikey
      };
    }

    const limitNumber = parseInt(limit) || 20;
    const offsetNumber = parseInt(offset) || 0;

    console.log(`API Key recibido: ${apikey}, Limit: ${limitNumber}, Offset: ${offsetNumber}`);

    // Llamar a la función de Tokko Helper con paginación
    const result = await this.tokkoHelperService.getProperties(apikey, limitNumber, offsetNumber);
    
    return {
      pagination_used: { limit: limitNumber, offset: offsetNumber },
      partnerResult: result
    };
  }

  /**
   * GET /partners/create-organization-tokko?apikey=xxx
   * Crear organización completa desde datos de Tokko
   */
  @Get('create-organization-tokko')
  async createOrganizationTokko(
    @Query('apikey') apikey: string,
  ) {
    if (!apikey) {
      return {
        error: 'API key is required',
        received: apikey
      };
    }

    return await this.tokkoHelperService.createOrganizationFromTokko(
      apikey,
      this.partnersService,
      this.partnerApiService
    );
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
