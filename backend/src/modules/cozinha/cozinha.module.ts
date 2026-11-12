import { Module } from '@nestjs/common';
import { AvisosModule } from '../avisos/avisos.module';
import { EquipeModule } from '../equipe/equipe.module';
import { CozinhaService } from './application/cozinha.service';
import { FilaDaCozinha } from './application/portas';
import { CozinhaController } from './http/cozinha.controller';
import { FilaDaCozinhaPg } from './infrastructure/fila-da-cozinha-pg';

@Module({
  imports: [EquipeModule, AvisosModule],
  controllers: [CozinhaController],
  providers: [CozinhaService, FilaDaCozinhaPg, { provide: FilaDaCozinha, useExisting: FilaDaCozinhaPg }],
})
export class CozinhaModule {}
