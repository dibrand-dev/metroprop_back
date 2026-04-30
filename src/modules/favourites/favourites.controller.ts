import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';

@Controller('favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post('toggle')
  toggle(@Body() toggleFavouriteDto: ToggleFavouriteDto) {
    return this.favouritesService.toggle(toggleFavouriteDto);
  }

  @Get('user/:userId')
  getByUserId(@Param('userId', ParseIntPipe) userId: number) {
    return this.favouritesService.getByUserId(userId);
  }
}