import { Module } from '@nestjs/common';
import { Lojas } from './application/portas';
import { MesaService } from './application/mesa.service';
import { LojasPg } from './infrastructure/lojas-pg';
import { AdminQrCodesController } from './http/admin-qrcodes.controller';
import { MesaController } from './http/mesa.controller';

@Module({
  controllers: [MesaController, AdminQrCodesController],
  providers: [MesaService, LojasPg, { provide: Lojas, useExisting: LojasPg }],
  exports: [MesaService, Lojas],
})
export class MesaModule {}
