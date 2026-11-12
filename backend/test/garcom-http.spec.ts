// App do garçom (fase 4) com a aplicação real (guards, pipes, filtro) e o banco trocado por
// versões em memória.
import { Module, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigModule } from '../src/config/config.module';
import { criarApp } from '../src/criar-app';
import { AvisosService } from '../src/modules/avisos/application/avisos.service';
import { EnviadorDePush, InscricoesPush, type NovaInscricao } from '../src/modules/avisos/application/portas';
import { CardapioService } from '../src/modules/cardapio/application/cardapio.service';
import { Catalogo, type Produto } from '../src/modules/cardapio/application/portas';
import { EquipeService } from '../src/modules/equipe/application/equipe.service';
import { Equipe, type NovoUsuario, type UsuarioComSenha } from '../src/modules/equipe/application/portas';
import { gerarHashDeSenha } from '../src/modules/equipe/domain/senha';
import { gerarSessao } from '../src/modules/equipe/domain/sessao';
import { SessaoDaEquipeGuard } from '../src/modules/equipe/http/sessao-da-equipe.guard';
import { GarcomService } from '../src/modules/garcom/application/garcom.service';
import {
  type AlteracaoDeItem,
  type ProntoParaLevar,
  type ResultadoDaAlteracao,
  type ResumoDaMesa,
  Salao,
} from '../src/modules/garcom/application/portas';
import { bloqueioDoItem } from '../src/modules/garcom/domain/edicao';
import { GarcomController } from '../src/modules/garcom/http/garcom.controller';
import { MesaService } from '../src/modules/mesa/application/mesa.service';
import { Lojas } from '../src/modules/mesa/application/portas';
import { PedidosService } from '../src/modules/pedidos/application/pedidos.service';
import { Comandas, type EnvioDaMesa, type NovoEnvio } from '../src/modules/pedidos/application/portas';

const LOJA = 'ad5c0141-f6e4-47a3-9313-b103260bb9a0';
const OUTRA_LOJA = '11111111-1111-4111-8111-111111111111';
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const ENVIO = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/teste',
  QR_TOKEN_SECRET: SEGREDO,
  ADMIN_API_KEY: 'chave-de-admin-de-teste-123456',
  PUBLIC_APP_URL: 'https://menu.exemplo.com/',
});

const PRODUTO: Produto = {
  id: '5e1ae7ce-884e-4c81-b961-486ad50eb61a',
  codigoDeBarras: '78',
  nome: 'BATATA FRITA 400G',
  descricao: '',
  preco: 32.5,
  imagemUrl: null,
  categoriaId: null,
  categoriaNome: null,
  unidadeId: null,
  unidadeCodigo: 1,
};

const usuarios: UsuarioComSenha[] = [];
const gravados: NovoEnvio[] = [];
const correcoes: AlteracaoDeItem[] = [];
const inscricoes: NovaInscricao[] = [];
let resultadoDaCorrecao: ResultadoDaAlteracao = 'ok';
let statusDoPronto: 'pronto' | 'entregue' = 'pronto';

class LojasFalsas extends Lojas {
  override async buscar(id: string) {
    return [LOJA, OUTRA_LOJA].includes(id) ? { id, companyId: 'c0000000-0000-4000-8000-000000000000', nome: 'EASY SOFT' } : null;
  }
}
class EquipeEmMemoria extends Equipe {
  override async buscarPorLogin(login: string) {
    return usuarios.find((u) => u.login.toLowerCase() === login.toLowerCase()) ?? null;
  }
  override async buscar(id: string) {
    return usuarios.find((u) => u.id === id) ?? null;
  }
  override async listarDaLoja(storeId: string) {
    return usuarios.filter((u) => u.storeId === storeId);
  }
  override async criar(novo: NovoUsuario) {
    const u: UsuarioComSenha = { ...novo, id: crypto.randomUUID(), ativo: true, sessaoVersao: 1 };
    usuarios.push(u);
    return u;
  }
  override async alterar() {
    return null;
  }
}
class CatalogoFalso extends Catalogo {
  override async listar(storeId: string) {
    return storeId === LOJA ? [PRODUTO] : [];
  }
  override async buscarPorIds(storeId: string, ids: string[]) {
    return (await this.listar(storeId)).filter((p) => ids.includes(p.id));
  }
}
const envioDaMesa = (status: EnvioDaMesa['status'], lancado = false): EnvioDaMesa => ({
  id: ENVIO,
  numero: 104,
  cliente: 'Carla',
  observacao: null,
  status,
  criadoEm: new Date().toISOString(),
  prontoEm: null,
  total: 65,
  itens: [
    { orderItemId: ITEM, nome: 'BATATA FRITA 400G', quantidade: 2, precoUnitario: 32.5, observacao: 'sem sal', cancelado: false, lancado },
  ],
});
class ComandasFalsas extends Comandas {
  override async registrarEnvio(envio: NovoEnvio) {
    gravados.push(envio);
    return { id: ENVIO, numero: 200 + gravados.length, comandaId: 'c' };
  }
  override async enviosDaMesa(storeId: string, mesa: string) {
    if (storeId !== LOJA || mesa !== '5') return [];
    return [envioDaMesa('recebido'), { ...envioDaMesa('em_preparo'), id: 'outro', numero: 105 }, { ...envioDaMesa('recebido', true), id: 'lancado', numero: 106 }];
  }
}
class SalaoEmMemoria extends Salao {
  override async mesasAbertas(storeId: string): Promise<ResumoDaMesa[]> {
    if (storeId !== LOJA) return [];
    const agora = new Date().toISOString();
    return [{ mesa: '5', abertaEm: agora, ultimoPedidoEm: agora, pedidos: 2, naCozinha: 1, prontos: 1, total: 97.5 }];
  }
  override async prontos(storeId: string): Promise<ProntoParaLevar[]> {
    if (storeId !== LOJA || statusDoPronto !== 'pronto') return [];
    return [{ id: ENVIO, numero: 104, mesa: '5', cliente: 'Carla', prontoEm: new Date().toISOString(), itens: [] }];
  }
  override async alterarItem(a: AlteracaoDeItem) {
    if (a.storeId !== LOJA) return 'nao_encontrado' as const;
    correcoes.push(a);
    return resultadoDaCorrecao;
  }
  override async marcarEntregue(storeId: string, envioId: string) {
    if (storeId !== LOJA || envioId !== ENVIO) return 'nao_encontrado' as const;
    if (statusDoPronto !== 'pronto') return 'status_mudou' as const;
    statusDoPronto = 'entregue';
    return 'ok' as const;
  }
}
class InscricoesEmMemoria extends InscricoesPush {
  override async salvar(i: NovaInscricao) {
    inscricoes.push(i);
  }
  override async remover(usuarioId: string, endpoint: string) {
    const n = inscricoes.findIndex((i) => i.usuarioId === usuarioId && i.endpoint === endpoint);
    if (n >= 0) inscricoes.splice(n, 1);
  }
  override async dosGarconsDaLoja() {
    return [];
  }
  override async apagar() {}
}
class EnviadorFalso extends EnviadorDePush {
  override readonly chavePublica = 'BPublicaDeTeste';
  override async enviar() {
    return 'entregue' as const;
  }
}

@Module({
  imports: [ConfigModule],
  controllers: [GarcomController],
  providers: [
    GarcomService,
    EquipeService,
    SessaoDaEquipeGuard,
    PedidosService,
    CardapioService,
    MesaService,
    AvisosService,
    { provide: Lojas, useClass: LojasFalsas },
    { provide: Equipe, useClass: EquipeEmMemoria },
    { provide: Catalogo, useClass: CatalogoFalso },
    { provide: Comandas, useClass: ComandasFalsas },
    { provide: Salao, useClass: SalaoEmMemoria },
    { provide: InscricoesPush, useClass: InscricoesEmMemoria },
    { provide: EnviadorDePush, useClass: EnviadorFalso },
  ],
})
class ModuloDeTeste {}

let app: INestApplication;
const http = () => request(app.getHttpServer());

/** Cria direto no repositório e devolve a sessão (o login em si é testado em cozinha-http.spec). */
async function sessao(papel: 'cozinha' | 'garcom', storeId = LOJA) {
  const u = await new EquipeEmMemoria().criar({
    companyId: 'c0000000-0000-4000-8000-000000000000',
    storeId,
    nome: papel === 'garcom' ? 'Ana' : 'João',
    login: `${papel}.${usuarios.length}`,
    senhaHash: await gerarHashDeSenha('segredo1'),
    papel,
  });
  return { id: u.id, auth: `Bearer ${gerarSessao({ usuarioId: u.id, storeId, papel, versao: 1 }, SEGREDO)}` };
}

beforeAll(async () => {
  app = await criarApp(ModuloDeTeste);
});
afterAll(() => app.close());
beforeEach(() => {
  usuarios.length = 0;
  gravados.length = 0;
  correcoes.length = 0;
  inscricoes.length = 0;
  resultadoDaCorrecao = 'ok';
  statusDoPronto = 'pronto';
});

describe('acesso', () => {
  it('sem sessão 401; cozinheiro não entra no app do garçom (403)', async () => {
    await http().get('/api/v1/garcom/painel').expect(401);
    const { auth } = await sessao('cozinha');
    const r = await http().get('/api/v1/garcom/painel').set('Authorization', auth).expect(403);
    expect(r.body.error).toBe('sem_permissao');
  });
});

describe('painel', () => {
  it('mostra os prontos para levar e as mesas abertas da loja do garçom', async () => {
    const { auth } = await sessao('garcom');
    const r = await http().get('/api/v1/garcom/painel').set('Authorization', auth).expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({
      restaurante: 'EASY SOFT',
      prontos: [{ numero: 104, mesa: '5', cliente: 'Carla' }],
      mesas: [{ mesa: '5', naCozinha: 1, prontos: 1, total: 97.5 }],
    });
  });

  it('garçom de outra loja não vê nada desta', async () => {
    const { auth } = await sessao('garcom', OUTRA_LOJA);
    const r = await http().get('/api/v1/garcom/painel').set('Authorization', auth).expect(200);
    expect(r.body).toMatchObject({ prontos: [], mesas: [] });
  });
});

describe('mesa', () => {
  it('diz, item a item, o que o garçom pode corrigir', async () => {
    const { auth } = await sessao('garcom');
    const r = await http().get('/api/v1/garcom/mesas/05').set('Authorization', auth).expect(200);
    expect(r.body.mesa).toBe('5');
    expect(r.body.total).toBe(195);
    expect(r.body.pedidos.map((p: { itens: { bloqueio: string | null }[] }) => p.itens[0]!.bloqueio)).toEqual([
      null,
      'cozinha_ja_comecou',
      'item_ja_lancado',
    ]);
    expect(r.body.pedidos[0].itens[0]).toMatchObject({ orderItemId: ITEM, quantidade: 2, observacao: 'sem sal' });
  });

  it('mesa inválida dá 422', async () => {
    const { auth } = await sessao('garcom');
    const r = await http().get('/api/v1/garcom/mesas/mesa%20com%20espaco').set('Authorization', auth).expect(422);
    expect(r.body.error).toBe('mesa_invalida');
  });
});

describe('pedido lançado pelo garçom', () => {
  it('grava com o preço do cadastro, o garçom como autor e o nome dele se ninguém foi informado', async () => {
    const { id, auth } = await sessao('garcom');
    const r = await http()
      .post('/api/v1/garcom/mesas/05/pedidos')
      .set('Authorization', auth)
      .send({ itens: [{ produtoId: PRODUTO.id, quantidade: 2, observacao: 'sem sal', preco: 0.01 }] })
      .expect(201);
    expect(r.body).toEqual({ numero: 201, total: 65 });
    expect(gravados[0]).toMatchObject({ storeId: LOJA, mesa: '5', cliente: 'Garçom Ana', garcomId: id, total: 65 });
    expect(gravados[0]!.itens[0]).toMatchObject({ precoUnitario: 32.5, observacao: 'sem sal' });

    await http()
      .post('/api/v1/garcom/mesas/5/pedidos')
      .set('Authorization', auth)
      .send({ cliente: 'Carla', itens: [{ produtoId: PRODUTO.id, quantidade: 1 }] })
      .expect(201);
    expect(gravados[1]!.cliente).toBe('Carla');
  });

  it('recusa pedido vazio e produto de outra loja', async () => {
    const { auth } = await sessao('garcom');
    await http().post('/api/v1/garcom/mesas/5/pedidos').set('Authorization', auth).send({ itens: [] }).expect(422);
    const r = await http()
      .post('/api/v1/garcom/mesas/5/pedidos')
      .set('Authorization', auth)
      .send({ itens: [{ produtoId: OUTRA_LOJA, quantidade: 1 }] })
      .expect(422);
    expect(r.body.error).toBe('produto_indisponivel');
    expect(gravados).toHaveLength(0);
  });

  it('cardápio do garçom é o da loja da sessão', async () => {
    const { auth } = await sessao('garcom');
    const r = await http().get('/api/v1/garcom/cardapio').set('Authorization', auth).expect(200);
    expect(r.body.produtos).toEqual([expect.objectContaining({ id: PRODUTO.id, preco: 32.5 })]);
    expect(r.body).not.toHaveProperty('mesa');
  });
});

describe('correção de item', () => {
  const corrigir = (auth: string, quantidade: unknown, envio = ENVIO, item = ITEM) =>
    http().patch(`/api/v1/garcom/pedidos/${envio}/itens/${item}`).set('Authorization', auth).send({ quantidade });

  it('muda a quantidade ou cancela (0), registrando quem fez', async () => {
    const { id, auth } = await sessao('garcom');
    await corrigir(auth, 1).expect(200, { quantidade: 1 });
    await corrigir(auth, 0).expect(200, { quantidade: 0 });
    expect(correcoes).toEqual([
      { storeId: LOJA, envioId: ENVIO, orderItemId: ITEM, quantidade: 1, usuarioId: id },
      { storeId: LOJA, envioId: ENVIO, orderItemId: ITEM, quantidade: 0, usuarioId: id },
    ]);
  });

  it.each([
    ['cozinha_ja_comecou', /cozinha já começou/],
    ['item_ja_lancado', /lançado no caixa/],
    ['item_cancelado', /já está cancelado/],
    ['comanda_fechada', /já foi fechada/],
  ] as const)('%s dá 409 com a explicação', async (codigo, mensagem) => {
    const { auth } = await sessao('garcom');
    resultadoDaCorrecao = codigo;
    const r = await corrigir(auth, 1).expect(409);
    expect(r.body.error).toBe(codigo);
    expect(r.body.message).toMatch(mensagem);
  });

  it('quantidade fora de 0..99 dá 422; id que não é uuid dá 404', async () => {
    const { auth } = await sessao('garcom');
    await corrigir(auth, 100).expect(422);
    await corrigir(auth, -1).expect(422);
    await corrigir(auth, 1.5).expect(422);
    await corrigir(auth, 1, 'lixo').expect(404);
    expect(correcoes).toHaveLength(0);
  });

  it('garçom de outra loja não corrige item desta', async () => {
    const { auth } = await sessao('garcom', OUTRA_LOJA);
    await corrigir(auth, 1).expect(404);
  });
});

describe('entregue', () => {
  it('marca uma vez; o segundo garçom recebe 409', async () => {
    const { auth } = await sessao('garcom');
    await http().post(`/api/v1/garcom/pedidos/${ENVIO}/entregue`).set('Authorization', auth).expect(200, { status: 'entregue' });
    const r = await http().post(`/api/v1/garcom/pedidos/${ENVIO}/entregue`).set('Authorization', auth).expect(409);
    expect(r.body.error).toBe('status_mudou');
  });
});

describe('push', () => {
  const fcm = 'https://fcm.googleapis.com/fcm/send/abc123';
  const chaves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

  it('entrega a chave pública e inscreve o celular do garçom', async () => {
    const { id, auth } = await sessao('garcom');
    await http().get('/api/v1/garcom/push').set('Authorization', auth).expect(200, { chavePublica: 'BPublicaDeTeste' });
    await http().post('/api/v1/garcom/push').set('Authorization', auth).send({ endpoint: fcm, keys: chaves }).expect(200);
    expect(inscricoes).toEqual([{ usuarioId: id, storeId: LOJA, endpoint: fcm, ...chaves }]);
    await http().post('/api/v1/garcom/push/remover').set('Authorization', auth).send({ endpoint: fcm }).expect(200);
    expect(inscricoes).toHaveLength(0);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/fcm',
    'https://fcm.googleapis.com.atacante.com/x',
    'https://atacante.com/fcm.googleapis.com',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
  ])('recusa endereço que não é de um serviço de push: %s', async (endpoint) => {
    const { auth } = await sessao('garcom');
    await http().post('/api/v1/garcom/push').set('Authorization', auth).send({ endpoint, keys: chaves }).expect(422);
    expect(inscricoes).toHaveLength(0);
  });

  it('aceita os serviços de push dos navegadores', async () => {
    const { auth } = await sessao('garcom');
    for (const endpoint of [
      fcm,
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGuQ',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) {
      await http().post('/api/v1/garcom/push').set('Authorization', auth).send({ endpoint, keys: chaves }).expect(200);
    }
    expect(inscricoes).toHaveLength(4);
  });
});

describe('regra de correção', () => {
  it('só enquanto a cozinha não começou e o item não foi lançado nem cancelado', () => {
    expect(bloqueioDoItem('recebido', { cancelado: false, lancado: false })).toBeNull();
    expect(bloqueioDoItem('em_preparo', { cancelado: false, lancado: false })).toBe('cozinha_ja_comecou');
    expect(bloqueioDoItem('pronto', { cancelado: false, lancado: false })).toBe('cozinha_ja_comecou');
    expect(bloqueioDoItem('recebido', { cancelado: false, lancado: true })).toBe('item_ja_lancado');
    expect(bloqueioDoItem('recebido', { cancelado: true, lancado: false })).toBe('item_cancelado');
  });
});
