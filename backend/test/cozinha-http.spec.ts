// Login da equipe, administração da equipe e tela da cozinha, com a aplicação real (guards, pipes,
// filtro) e os repositórios trocados por versões em memória.
import { Module, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroDeNegocio } from '../src/common/erros/erro-de-negocio';
import { ConfigModule } from '../src/config/config.module';
import { criarApp } from '../src/criar-app';
import { AvisosService } from '../src/modules/avisos/application/avisos.service';
import { EnviadorDePush, InscricoesPush, type InscricaoPush, type MensagemDePush } from '../src/modules/avisos/application/portas';
import { CozinhaService } from '../src/modules/cozinha/application/cozinha.service';
import { FilaDaCozinha, type PedidoNaCozinha, type ResultadoDaMudanca } from '../src/modules/cozinha/application/portas';
import { transicaoPermitida } from '../src/modules/cozinha/domain/andamento';
import { CozinhaController } from '../src/modules/cozinha/http/cozinha.controller';
import { EquipeService } from '../src/modules/equipe/application/equipe.service';
import {
  Equipe,
  type MudancasNoUsuario,
  type NovoUsuario,
  type UsuarioComSenha,
} from '../src/modules/equipe/application/portas';
import { gerarSessao } from '../src/modules/equipe/domain/sessao';
import { AdminEquipeController } from '../src/modules/equipe/http/admin-equipe.controller';
import { EquipeController } from '../src/modules/equipe/http/equipe.controller';
import { SessaoDaEquipeGuard } from '../src/modules/equipe/http/sessao-da-equipe.guard';
import { Lojas } from '../src/modules/mesa/application/portas';
import type { StatusNaCozinha } from '../src/modules/pedidos/domain/pedido';

const LOJA = 'ad5c0141-f6e4-47a3-9313-b103260bb9a0';
const OUTRA_LOJA = '11111111-1111-4111-8111-111111111111';
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const CHAVE = 'chave-de-admin-de-teste-123456';
const ENVIO = '22222222-2222-4222-8222-222222222222';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/teste',
  QR_TOKEN_SECRET: SEGREDO,
  ADMIN_API_KEY: CHAVE,
  PUBLIC_APP_URL: 'https://menu.exemplo.com/',
});

const usuarios: UsuarioComSenha[] = [];
const envios: { storeId: string; pedido: PedidoNaCozinha }[] = [];

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
    if (await this.buscarPorLogin(novo.login)) {
      throw new ErroDeNegocio(409, 'login_em_uso', 'Este login já está em uso. Escolha outro.');
    }
    const u: UsuarioComSenha = { ...novo, id: crypto.randomUUID(), ativo: true, sessaoVersao: 1 };
    usuarios.push(u);
    return u;
  }
  override async alterar(storeId: string, id: string, m: MudancasNoUsuario) {
    const u = usuarios.find((x) => x.id === id && x.storeId === storeId);
    if (!u) return null;
    if (m.senhaHash !== undefined || (m.ativo !== undefined && m.ativo !== u.ativo)) u.sessaoVersao++;
    Object.assign(u, Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)));
    return u;
  }
}

class FilaEmMemoria extends FilaDaCozinha {
  override async listar(storeId: string) {
    return envios.filter((e) => e.storeId === storeId).map((e) => e.pedido);
  }
  override async mudarStatus(storeId: string, id: string, de: StatusNaCozinha, para: StatusNaCozinha): Promise<ResultadoDaMudanca> {
    const e = envios.find((x) => x.pedido.id === id && x.storeId === storeId);
    if (!e) return 'nao_encontrado';
    if (e.pedido.status !== de) return 'status_mudou';
    e.pedido.status = para;
    return { numero: e.pedido.numero, mesa: e.pedido.mesa, cliente: e.pedido.cliente };
  }
}

const pushEnviados: { endpoint: string; mensagem: MensagemDePush }[] = [];
const inscritos: (InscricaoPush & { storeId: string })[] = [];
class InscricoesEmMemoria extends InscricoesPush {
  override async salvar() {}
  override async remover() {}
  override async dosGarconsDaLoja(storeId: string) {
    return inscritos.filter((i) => i.storeId === storeId);
  }
  override async apagar(ids: string[]) {
    for (const id of ids) inscritos.splice(inscritos.findIndex((i) => i.id === id), 1);
  }
}
class EnviadorFalso extends EnviadorDePush {
  override readonly chavePublica = 'chave-publica-de-teste';
  override async enviar(i: InscricaoPush, mensagem: MensagemDePush) {
    if (i.endpoint.endsWith('/expirado')) return 'expirada' as const;
    pushEnviados.push({ endpoint: i.endpoint, mensagem });
    return 'entregue' as const;
  }
}

@Module({
  imports: [ConfigModule],
  controllers: [EquipeController, AdminEquipeController, CozinhaController],
  providers: [
    EquipeService,
    CozinhaService,
    AvisosService,
    SessaoDaEquipeGuard,
    { provide: InscricoesPush, useClass: InscricoesEmMemoria },
    { provide: EnviadorDePush, useClass: EnviadorFalso },
    { provide: Lojas, useClass: LojasFalsas },
    { provide: Equipe, useClass: EquipeEmMemoria },
    { provide: FilaDaCozinha, useClass: FilaEmMemoria },
  ],
})
class ModuloDeTeste {}

let app: INestApplication;
const http = () => request(app.getHttpServer());
const admin = { 'X-Admin-Key': CHAVE };

async function criarUsuario(login: string, papel: 'cozinha' | 'garcom', storeId = LOJA) {
  const r = await http()
    .post('/api/v1/admin/equipe')
    .set(admin)
    .send({ storeId, nome: `Pessoa ${login}`, login, senha: 'segredo1', papel })
    .expect(201);
  return r.body as { id: string };
}
async function entrar(login: string, senha = 'segredo1') {
  return (await http().post('/api/v1/equipe/entrar').send({ login, senha }).expect(200)).body.token as string;
}

beforeAll(async () => {
  app = await criarApp(ModuloDeTeste);
});
afterAll(() => app.close());
beforeEach(() => {
  usuarios.length = 0;
  envios.length = 0;
  pushEnviados.length = 0;
  inscritos.length = 0;
  envios.push({
    storeId: LOJA,
    pedido: {
      id: ENVIO, numero: 103, mesa: '3', cliente: 'Maria', observacao: 'trazer junto', status: 'recebido',
      criadoEm: new Date().toISOString(), iniciadoEm: null, prontoEm: null,
      itens: [{ nome: 'BATATA FRITA 400G', quantidade: 1, observacao: 'sem sal', cancelado: false }],
    },
  });
});

describe('administração da equipe', () => {
  it('exige a chave de administrador', async () => {
    await http().get(`/api/v1/admin/equipe?storeId=${LOJA}`).expect(401);
    await http().post('/api/v1/admin/equipe').set({ 'X-Admin-Key': 'errada' }).send({}).expect(401);
  });

  it('cria, lista sem expor a senha e recusa login repetido', async () => {
    await criarUsuario('joao.cozinha', 'cozinha');
    const lista = await http().get(`/api/v1/admin/equipe?storeId=${LOJA}`).set(admin).expect(200);
    expect(lista.body.usuarios).toEqual([
      expect.objectContaining({ login: 'joao.cozinha', papel: 'cozinha', ativo: true }),
    ]);
    expect(JSON.stringify(lista.body)).not.toMatch(/segredo1|scrypt|senha/i);
    expect(usuarios[0]!.senhaHash).toMatch(/^scrypt\$/);

    const r = await http()
      .post('/api/v1/admin/equipe')
      .set(admin)
      .send({ storeId: LOJA, nome: 'Outro', login: 'JOAO.COZINHA', senha: 'segredo1', papel: 'garcom' })
      .expect(409);
    expect(r.body.error).toBe('login_em_uso');
  });

  it.each([
    ['senha curta', { senha: '123' }],
    ['login com espaço', { login: 'joao silva' }],
    ['papel desconhecido', { papel: 'gerente' }],
    ['loja não-uuid', { storeId: '1' }],
  ])('recusa %s com 422', async (_n, troca) => {
    const corpo = { storeId: LOJA, nome: 'Joao', login: 'joao', senha: 'segredo1', papel: 'cozinha', ...troca };
    await http().post('/api/v1/admin/equipe').set(admin).send(corpo).expect(422);
  });

  it('loja inexistente dá 404', async () => {
    const r = await http()
      .post('/api/v1/admin/equipe')
      .set(admin)
      .send({ storeId: '33333333-3333-4333-8333-333333333333', nome: 'Joao', login: 'joao', senha: 'segredo1', papel: 'cozinha' })
      .expect(404);
    expect(r.body.error).toBe('loja_nao_encontrada');
  });
});

describe('login da equipe', () => {
  it('entra com usuário e senha (login sem diferenciar maiúsculas)', async () => {
    await criarUsuario('joao.cozinha', 'cozinha');
    const r = await http().post('/api/v1/equipe/entrar').send({ login: 'Joao.Cozinha', senha: 'segredo1' }).expect(200);
    expect(r.body).toMatchObject({ restaurante: 'EASY SOFT', usuario: { login: 'joao.cozinha', papel: 'cozinha' } });
    const eu = await http().get('/api/v1/equipe/eu').set('Authorization', `Bearer ${r.body.token}`).expect(200);
    expect(eu.body.usuario.login).toBe('joao.cozinha');
  });

  it('senha errada, usuário inexistente e usuário desativado dão a MESMA resposta', async () => {
    const { id } = await criarUsuario('joao.cozinha', 'cozinha');
    await http().patch(`/api/v1/admin/equipe/${id}`).set(admin).send({ storeId: LOJA, ativo: false }).expect(200);
    const respostas = await Promise.all(
      [
        { login: 'joao.cozinha', senha: 'segredo1' },
        { login: 'joao.cozinha', senha: 'errada' },
        { login: 'ninguem', senha: 'segredo1' },
      ].map((c) => http().post('/api/v1/equipe/entrar').send(c).expect(401)),
    );
    for (const r of respostas) expect(r.body).toEqual({ error: 'login_invalido', message: 'Usuário ou senha incorretos.', statusCode: 401 });
  });

  it('trocar a senha ou desativar derruba a sessão aberta', async () => {
    const { id } = await criarUsuario('joao.cozinha', 'cozinha');
    const token = await entrar('joao.cozinha');
    await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${token}`).expect(200);

    await http().patch(`/api/v1/admin/equipe/${id}`).set(admin).send({ storeId: LOJA, senha: 'nova-senha' }).expect(200);
    const r = await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${token}`).expect(401);
    expect(r.body.error).toBe('sessao_encerrada');
    await entrar('joao.cozinha', 'nova-senha');
  });

  it('administrador de uma loja não altera usuário de outra', async () => {
    const { id } = await criarUsuario('joao.cozinha', 'cozinha');
    await http().patch(`/api/v1/admin/equipe/${id}`).set(admin).send({ storeId: OUTRA_LOJA, ativo: false }).expect(404);
    expect(usuarios[0]!.ativo).toBe(true);
  });
});

describe('tela da cozinha', () => {
  it('sem sessão, com sessão forjada ou expirada: 401', async () => {
    await http().get('/api/v1/cozinha/pedidos').expect(401);
    await http().get('/api/v1/cozinha/pedidos').set('Authorization', 'Bearer lixo').expect(401);
    const { id } = await criarUsuario('joao.cozinha', 'cozinha');
    const vencida = gerarSessao({ usuarioId: id, storeId: LOJA, papel: 'cozinha', versao: 1 }, SEGREDO, Date.now() - 15 * 3600_000);
    await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${vencida}`).expect(401);
  });

  it('garçom não entra na tela da cozinha (403)', async () => {
    await criarUsuario('ana.garcom', 'garcom');
    const token = await entrar('ana.garcom');
    const r = await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${token}`).expect(403);
    expect(r.body.error).toBe('sem_permissao');
  });

  it('lista os pedidos da loja do cozinheiro, com observações', async () => {
    await criarUsuario('joao.cozinha', 'cozinha');
    const token = await entrar('joao.cozinha');
    const r = await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.pedidos).toEqual([expect.objectContaining({ numero: 103, mesa: '3', observacao: 'trazer junto' })]);
    expect(r.body.pedidos[0].itens[0]).toEqual({ nome: 'BATATA FRITA 400G', quantidade: 1, observacao: 'sem sal', cancelado: false });
  });

  it('cozinheiro de outra loja não vê nem mexe nos pedidos desta', async () => {
    await criarUsuario('pedro.outra', 'cozinha', OUTRA_LOJA);
    const token = await entrar('pedro.outra');
    const r = await http().get('/api/v1/cozinha/pedidos').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.pedidos).toEqual([]);
    await http()
      .post(`/api/v1/cozinha/pedidos/${ENVIO}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ de: 'recebido', para: 'em_preparo' })
      .expect(404);
    expect(envios[0]!.pedido.status).toBe('recebido');
  });

  it('iniciar → pronto → desfazer, e recusa pular etapa ou mudança já feita em outra tela', async () => {
    await criarUsuario('joao.cozinha', 'cozinha');
    const token = await entrar('joao.cozinha');
    const mudar = (de: string, para: string) =>
      http().post(`/api/v1/cozinha/pedidos/${ENVIO}/status`).set('Authorization', `Bearer ${token}`).send({ de, para });

    expect((await mudar('recebido', 'pronto').expect(422)).body.error).toBe('mudanca_invalida');
    await mudar('recebido', 'em_preparo').expect(200, { status: 'em_preparo' });
    expect((await mudar('recebido', 'em_preparo').expect(409)).body.error).toBe('status_mudou');
    await mudar('em_preparo', 'pronto').expect(200);
    await mudar('pronto', 'em_preparo').expect(200);
    expect(envios[0]!.pedido.status).toBe('em_preparo');
  });

  it('"Pronto" avisa por push os garçons da loja e apaga o celular que expirou', async () => {
    inscritos.push(
      { id: 'a', storeId: LOJA, endpoint: 'https://fcm.googleapis.com/fcm/send/ana', p256dh: 'p', auth: 'a' },
      { id: 'b', storeId: LOJA, endpoint: 'https://fcm.googleapis.com/fcm/send/expirado', p256dh: 'p', auth: 'a' },
      { id: 'c', storeId: OUTRA_LOJA, endpoint: 'https://fcm.googleapis.com/fcm/send/outra', p256dh: 'p', auth: 'a' },
    );
    await criarUsuario('joao.cozinha', 'cozinha');
    const token = await entrar('joao.cozinha');
    const mudar = (de: string, para: string) =>
      http().post(`/api/v1/cozinha/pedidos/${ENVIO}/status`).set('Authorization', `Bearer ${token}`).send({ de, para }).expect(200);

    await mudar('recebido', 'em_preparo');
    expect(pushEnviados).toHaveLength(0);
    await mudar('em_preparo', 'pronto');
    await vi.waitFor(() => expect(pushEnviados).toHaveLength(1));
    expect(pushEnviados[0]).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/ana',
      mensagem: { titulo: 'Mesa 3 — pedido pronto', corpo: '#103 · Maria. Pode levar à mesa.', tag: `pronto-${ENVIO}`, url: '/garcom' },
    });
    await vi.waitFor(() => expect(inscritos.map((i) => i.id)).toEqual(['a', 'c']));
  });
});

describe('andamento', () => {
  it('só um passo por vez, para frente ou para trás', () => {
    expect(transicaoPermitida('recebido', 'em_preparo')).toBe(true);
    expect(transicaoPermitida('em_preparo', 'pronto')).toBe(true);
    expect(transicaoPermitida('pronto', 'em_preparo')).toBe(true);
    expect(transicaoPermitida('em_preparo', 'recebido')).toBe(true);
    expect(transicaoPermitida('recebido', 'pronto')).toBe(false);
    expect(transicaoPermitida('pronto', 'recebido')).toBe(false);
    expect(transicaoPermitida('pronto', 'pronto')).toBe(false);
  });
});
