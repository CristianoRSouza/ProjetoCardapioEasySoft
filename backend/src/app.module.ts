import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DbModule } from './infra/db/db.module';
import { CardapioModule } from './modules/cardapio/cardapio.module';
import { CozinhaModule } from './modules/cozinha/cozinha.module';
import { EquipeModule } from './modules/equipe/equipe.module';
import { GarcomModule } from './modules/garcom/garcom.module';
import { HealthController } from './modules/health/health.controller';
import { MesaModule } from './modules/mesa/mesa.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    // Limite geral por IP; envio de pedido e geração de QR têm limites próprios mais apertados.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    MesaModule,
    CardapioModule,
    PedidosModule,
    EquipeModule,
    CozinhaModule,
    GarcomModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
