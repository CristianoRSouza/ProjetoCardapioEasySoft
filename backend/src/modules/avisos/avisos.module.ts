import { Module } from '@nestjs/common';
import { AvisosService } from './application/avisos.service';
import { EnviadorDePush, InscricoesPush } from './application/portas';
import { EnviadorWebPush } from './infrastructure/enviador-web-push';
import { InscricoesPushPg } from './infrastructure/inscricoes-push-pg';

@Module({
  providers: [
    AvisosService,
    InscricoesPushPg,
    EnviadorWebPush,
    { provide: InscricoesPush, useExisting: InscricoesPushPg },
    { provide: EnviadorDePush, useExisting: EnviadorWebPush },
  ],
  exports: [AvisosService, InscricoesPush],
})
export class AvisosModule {}
