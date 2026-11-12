import { Module } from '@nestjs/common';
import { AvisosModule } from '../avisos/avisos.module';
import { CardapioModule } from '../cardapio/cardapio.module';
import { EquipeModule } from '../equipe/equipe.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { GarcomService } from './application/garcom.service';
import { Salao } from './application/portas';
import { GarcomController } from './http/garcom.controller';
import { SalaoPg } from './infrastructure/salao-pg';

@Module({
  imports: [EquipeModule, PedidosModule, CardapioModule, AvisosModule],
  controllers: [GarcomController],
  providers: [GarcomService, SalaoPg, { provide: Salao, useExisting: SalaoPg }],
})
export class GarcomModule {}
