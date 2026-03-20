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
import { UseGuards } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerApiService } from './partner-api.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { TokkoHelperService } from '../../common/helpers/tokko-helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiExcludeController()
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly partnerApiService: PartnerApiService,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
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

  /**
   * Listado de partners con paginación
   * @param limit 
   * @param offset 
   * @returns Json list partners 
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.partnersService.findAll(parseInt(limit), parseInt(offset));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partnersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    return this.partnersService.update(id, updatePartnerDto);
  }

  /**
   * GET /partners/:id/refresh-access-key
   * Genera nuevos access keys seguros para un partner
   */
  @Get(':id/refresh-access-key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  async refreshAccessKey(@Param('id', ParseIntPipe) id: number) {
    const updatedPartner = await this.partnersService.refreshAccessKeys(id);
    return {
      success: true,
      message: 'Access keys refreshed successfully',
      data: updatedPartner,
    };
  }

  /**
   * GET /partners/:id/disable
   * Deshabilita un partner cambiando su status a inactivo
   */
  @Get(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  async disablePartner(@Param('id', ParseIntPipe) id: number) {
    const updatedPartner = await this.partnersService.disable(id);
    return {
      success: true,
      message: 'Partner disabled successfully',
      data: updatedPartner,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER_ROL_SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.partnersService.remove(id);
  }

}
