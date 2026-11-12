import { Controller, Get, Param } from '@nestjs/common';
import { MesaService } from '../application/mesa.service';

@Controller('mesas')
export class MesaController {
  constructor(private readonly mesas: MesaService) {}

  /** O front chama ao abrir o link do QR: confirma a mesa e mostra o nome do restaurante. */
  @Get(':token')
  async abrir(@Param('token') token: string) {
    const { loja, mesa } = await this.mesas.abrir(token);
    return { mesa, restaurante: loja.nome };
  }
}
