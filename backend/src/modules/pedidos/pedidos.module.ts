import { Module } from '@nestjs/common';
import { CardapioModule } from '../cardapio/cardapio.module';
import { MesaModule } from '../mesa/mesa.module';
import { PedidosService } from './application/pedidos.service';
import { Comandas } from './application/portas';
import { PedidosController } from './http/pedidos.controller';
import { ComandasPg } from './infrastructure/comandas-pg';

@Module({
  imports: [MesaModule, CardapioModule],
  controllers: [PedidosController],
  providers: [PedidosService, ComandasPg, { provide: Comandas, useExisting: ComandasPg }],
  exports: [PedidosService, Comandas],
})
export class PedidosModule {}
