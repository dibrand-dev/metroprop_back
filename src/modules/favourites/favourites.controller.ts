import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  toggle( @Req() request: Request, @Body() toggleFavouriteDto: ToggleFavouriteDto) {
    const user = (request as any).user;
    console.log("User in toggle:", user);
    if (user.id) {
      toggleFavouriteDto.user_id = user.id;
      return this.favouritesService.toggle(toggleFavouriteDto);
    }
    return false;
  }

  @Get('list-ids')
    @UseGuards(JwtAuthGuard)
    getByUserId( @Req() request: Request) {
      const user = (request as any).user;
      if (user.id) {
        return this.favouritesService.getPropertyIdsByUserId(user.id);
      }
      return [];
    }

  @Get('my-favourites')
    @UseGuards(JwtAuthGuard)
    myProperties(
      @Req() request: Request,
    ) {
      const user = (request as any).user;

      if (user.id) {
        return this.favouritesService.getFavouriteProperties(user.id);
      }

      return [];
    }
}