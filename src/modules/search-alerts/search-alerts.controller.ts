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
  UseGuards,
  Request,
} from '@nestjs/common';
import { SearchAlertsService } from './search-alerts.service';
import { CreateSearchAlertDto } from './dto/create-search-alert.dto';
import { UpdateSearchAlertDto } from './dto/update-search-alert.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('search-alerts')
@UseGuards(JwtAuthGuard)
export class SearchAlertsController {
  constructor(private readonly searchAlertsService: SearchAlertsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateSearchAlertDto) {
    return this.searchAlertsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.searchAlertsService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.searchAlertsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSearchAlertDto,
  ) {
    return this.searchAlertsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.searchAlertsService.remove(id, req.user.id);
  }
}
