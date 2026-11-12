import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import type { Logado } from '../../equipe/application/equipe.service';
import { Papeis, SessaoDaEquipeGuard, UsuarioLogado } from '../../equipe/http/sessao-da-equipe.guard';
import { CozinhaService } from '../application/cozinha.service';

const status = z.enum(['recebido', 'em_preparo', 'pronto']);
const Mudanca = z.object({ de: status, para: status });

@Controller('cozinha/pedidos')
@UseGuards(SessaoDaEquipeGuard)
@Papeis('cozinha')
export class CozinhaController {
  constructor(private readonly cozinha: CozinhaService) {}

  /**
   * A tela consulta a cada 3 s o dia inteiro: fica fora do limite geral por IP (que derrubaria a
   * cozinha), protegida pela sessão.
   */
  @Get()
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  listar(@UsuarioLogado() logado: Logado) {
    return this.cozinha.pedidos(logado);
  }

  @Post(':id/status')
  @HttpCode(200)
  mudar(
    @UsuarioLogado() logado: Logado,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
    @Body(new ValidarComZod(Mudanca)) { de, para }: z.infer<typeof Mudanca>,
  ) {
    return this.cozinha.mudarStatus(logado, id, de, para);
  }
}
