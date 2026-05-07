import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post('toggle')
  toggle(@Body() toggleFavouriteDto: ToggleFavouriteDto) {
    return this.favouritesService.toggle(toggleFavouriteDto);
  }

  @Get('list-ids')
    @UseGuards(JwtAuthGuard)
    getByUserId( @Req() request: Request) {
      const user = (request as any).user;
      if (user.user_id) {
        return this.favouritesService.getPropertyIdsByUserId(user.user_id);
      }
      return [];
    }

  @Get('my-favourites')
    @UseGuards(JwtAuthGuard)
    myProperties(
      @Req() request: Request,
    ) {
      const user = (request as any).user;

      if (user.user_id) {
        return this.favouritesService.getFavouriteProperties(user.user_id);
      }

      return [];
    }
}