import { Controller, Get, Header, Param } from '@nestjs/common';
import { CardapioService } from '../application/cardapio.service';

@Controller('mesas/:token/cardapio')
export class CardapioController {
  constructor(private readonly cardapio: CardapioService) {}

  @Get()
  @Header('Cache-Control', 'private, max-age=30')
  daMesa(@Param('token') token: string) {
    return this.cardapio.daMesa(token);
  }
}
