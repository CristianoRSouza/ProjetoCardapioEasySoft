import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import { MesaService } from '../application/mesa.service';
import { ChaveDeAdminGuard } from './chave-de-admin.guard';

const PedidoDeQrCodes = z.object({
  storeId: z.uuid('storeId deve ser o id (uuid) da loja'),
  mesas: z.array(z.string().min(1)).min(1).max(300),
});

@Controller('admin/qrcodes')
@UseGuards(ChaveDeAdminGuard)
export class AdminQrCodesController {
  constructor(private readonly mesas: MesaService) {}

  /** Gera os links assinados para imprimir os QR codes das mesas de uma loja. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async gerar(@Body(new ValidarComZod(PedidoDeQrCodes)) corpo: z.infer<typeof PedidoDeQrCodes>) {
    const { loja, qrcodes } = await this.mesas.gerarQrCodes(corpo.storeId, corpo.mesas);
    return { restaurante: loja.nome, qrcodes };
  }
}
