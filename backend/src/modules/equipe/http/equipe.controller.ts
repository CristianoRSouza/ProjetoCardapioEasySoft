import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import { EquipeService, type Logado } from '../application/equipe.service';
import { Papeis, SessaoDaEquipeGuard, UsuarioLogado } from './sessao-da-equipe.guard';

const Entrada = z.object({
  login: z.string().trim().min(1, 'informe o usuário').max(40),
  senha: z.string().min(1, 'informe a senha').max(100),
});

@Controller('equipe')
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  /** Login da cozinha (e, na fase 4, do garçom). Limite apertado contra tentativa de senha. */
  @Post('entrar')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  entrar(@Body(new ValidarComZod(Entrada)) corpo: z.infer<typeof Entrada>) {
    return this.equipe.entrar(corpo.login, corpo.senha);
  }

  /** Confere a sessão guardada no aparelho (a tela abre direto se ainda valer). */
  @Get('eu')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessaoDaEquipeGuard)
  @Papeis('cozinha', 'garcom')
  eu(@UsuarioLogado() { usuario, loja }: Logado) {
    return { usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, papel: usuario.papel }, restaurante: loja.nome };
  }
}
