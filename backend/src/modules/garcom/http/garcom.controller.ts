import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import type { Logado } from '../../equipe/application/equipe.service';
import { Papeis, SessaoDaEquipeGuard, UsuarioLogado } from '../../equipe/http/sessao-da-equipe.guard';
import { EnvioDoCliente } from '../../pedidos/http/pedidos.controller';
import { GarcomService } from '../application/garcom.service';

const uuid = () => new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** O garçom lança pelo mesmo formato do cliente; o nome de quem pediu é opcional. */
const PedidoDoGarcom = EnvioDoCliente.extend({ cliente: z.string().trim().max(40).optional() });

const Correcao = z.object({ quantidade: z.number().int().min(0).max(99) });

/**
 * Só servidores de push dos navegadores. A API faz POST no endpoint que o celular informa: sem esta
 * lista, alguém com login de garçom faria a API chamar endereços internos (SSRF).
 */
const SERVIDORES_DE_PUSH = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
const endpoint = z
  .url()
  .max(1000)
  .refine((u) => {
    const url = new URL(u);
    return url.protocol === 'https:' && !url.port && SERVIDORES_DE_PUSH.some((r) => r.test(url.hostname));
  }, 'endereço de push não reconhecido');
const chave = (max: number) => z.string().regex(/^[A-Za-z0-9_-]+=*$/, 'chave inválida').max(max);
const Inscricao = z.object({ endpoint, keys: z.object({ p256dh: chave(200), auth: chave(100) }) });
const Remocao = z.object({ endpoint: z.string().max(1000) });

@Controller('garcom')
@UseGuards(SessaoDaEquipeGuard)
@Papeis('garcom')
export class GarcomController {
  constructor(private readonly garcom: GarcomService) {}

  /** O app consulta a cada poucos segundos durante o turno: fora do limite por IP, como a cozinha. */
  @Get('painel')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  painel(@UsuarioLogado() logado: Logado) {
    return this.garcom.painel(logado);
  }

  @Get('mesas/:mesa')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  mesa(@UsuarioLogado() logado: Logado, @Param('mesa') mesa: string) {
    return this.garcom.mesa(logado, mesa);
  }

  @Get('cardapio')
  @Header('Cache-Control', 'private, max-age=30')
  cardapio(@UsuarioLogado() logado: Logado) {
    return this.garcom.cardapioDaLoja(logado);
  }

  @Post('mesas/:mesa/pedidos')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  pedir(
    @UsuarioLogado() logado: Logado,
    @Param('mesa') mesa: string,
    @Body(new ValidarComZod(PedidoDoGarcom)) corpo: z.infer<typeof PedidoDoGarcom>,
  ) {
    return this.garcom.pedir(logado, mesa, corpo);
  }

  @Patch('pedidos/:envio/itens/:item')
  corrigir(
    @UsuarioLogado() logado: Logado,
    @Param('envio', uuid()) envio: string,
    @Param('item', uuid()) item: string,
    @Body(new ValidarComZod(Correcao)) { quantidade }: z.infer<typeof Correcao>,
  ) {
    return this.garcom.alterarItem(logado, envio, item, quantidade);
  }

  @Post('pedidos/:envio/entregue')
  @HttpCode(200)
  entregue(@UsuarioLogado() logado: Logado, @Param('envio', uuid()) envio: string) {
    return this.garcom.entregue(logado, envio);
  }

  @Get('push')
  @Header('Cache-Control', 'no-store')
  chaveDoPush() {
    return this.garcom.chaveDoPush();
  }

  @Post('push')
  @HttpCode(200)
  inscrever(@UsuarioLogado() logado: Logado, @Body(new ValidarComZod(Inscricao)) corpo: z.infer<typeof Inscricao>) {
    return this.garcom.inscrever(logado, corpo);
  }

  @Post('push/remover')
  @HttpCode(200)
  desinscrever(@UsuarioLogado() logado: Logado, @Body(new ValidarComZod(Remocao)) { endpoint }: z.infer<typeof Remocao>) {
    return this.garcom.desinscrever(logado, endpoint);
  }
}
