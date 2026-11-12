import { Module } from '@nestjs/common';
import { MesaModule } from '../mesa/mesa.module';
import { EquipeService } from './application/equipe.service';
import { Equipe } from './application/portas';
import { AdminEquipeController } from './http/admin-equipe.controller';
import { EquipeController } from './http/equipe.controller';
import { SessaoDaEquipeGuard } from './http/sessao-da-equipe.guard';
import { EquipePg } from './infrastructure/equipe-pg';

@Module({
  imports: [MesaModule],
  controllers: [EquipeController, AdminEquipeController],
  providers: [EquipeService, SessaoDaEquipeGuard, EquipePg, { provide: Equipe, useExisting: EquipePg }],
  exports: [EquipeService, SessaoDaEquipeGuard],
})
export class EquipeModule {}
