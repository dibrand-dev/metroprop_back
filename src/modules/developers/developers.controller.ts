import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';

@Controller('developers')
export class DevelopersController {
  @Get()
  serveDocs(@Res() res: Response) {
    res.sendFile(path.join(__dirname, '..', '..', '..', 'public', 'developers', 'index.html'));
  }
}
