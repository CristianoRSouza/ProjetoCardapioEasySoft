import { Module } from '@nestjs/common';
import { MesaModule } from '../mesa/mesa.module';
import { CardapioService } from './application/cardapio.service';
import { Catalogo } from './application/portas';
import { CardapioController } from './http/cardapio.controller';
import { CatalogoPg } from './infrastructure/catalogo-pg';

@Module({
  imports: [MesaModule],
  controllers: [CardapioController],
  providers: [CardapioService, CatalogoPg, { provide: Catalogo, useExisting: CatalogoPg }],
  exports: [Catalogo, CardapioService],
})
export class CardapioModule {}
