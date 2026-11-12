import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import { PedidosService } from '../application/pedidos.service';

const texto = (max: number) => z.string().trim().max(max);

export const EnvioDoCliente = z.object({
  cliente: texto(40).min(2, 'informe seu nome'),
  observacao: texto(200).optional(),
  itens: z
    .array(
      z.object({
        produtoId: z.uuid(),
        quantidade: z.number().int().min(1).max(99),
        observacao: texto(140).optional(),
      }),
    )
    .min(1, 'o pedido está vazio')
    .max(50),
});

@Controller('mesas/:token/pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enviar(@Param('token') token: string, @Body(new ValidarComZod(EnvioDoCliente)) corpo: z.infer<typeof EnvioDoCliente>) {
    return this.pedidos.enviar(token, corpo);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  daMesa(@Param('token') token: string) {
    return this.pedidos.daMesa(token);
  }
}
