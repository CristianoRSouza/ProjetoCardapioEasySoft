// Testes de HTTP com a aplicação real (pipes, filtro, throttler, guard), só com o banco trocado.
import { Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConfigModule } from '../src/config/config.module';
import { criarApp } from '../src/criar-app';
import { Catalogo, type Produto } from '../src/modules/cardapio/application/portas';
import { CardapioService } from '../src/modules/cardapio/application/cardapio.service';
import { CardapioController } from '../src/modules/cardapio/http/cardapio.controller';
import { Lojas } from '../src/modules/mesa/application/portas';
import { MesaService } from '../src/modules/mesa/application/mesa.service';
import { gerarToken } from '../src/modules/mesa/domain/token-da-mesa';
import { AdminQrCodesController } from '../src/modules/mesa/http/admin-qrcodes.controller';
import { MesaController } from '../src/modules/mesa/http/mesa.controller';
import { Comandas, type EnvioDaMesa, type NovoEnvio } from '../src/modules/pedidos/application/portas';
import { PedidosService } from '../src/modules/pedidos/application/pedidos.service';
import { PedidosController } from '../src/modules/pedidos/http/pedidos.controller';

const LOJA = 'ad5c0141-f6e4-47a3-9313-b103260bb9a0';
const OUTRA_LOJA = '11111111-1111-4111-8111-111111111111';
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const CHAVE = 'chave-de-admin-de-teste-123456';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/teste',
  QR_TOKEN_SECRET: SEGREDO,
  ADMIN_API_KEY: CHAVE,
  PUBLIC_APP_URL: 'https://menu.exemplo.com/',
});

const PRODUTO: Produto = {
  id: '5e1ae7ce-884e-4c81-b961-486ad50eb61a',
  codigoDeBarras: '78',
  nome: 'DOSE DE SMIRNOFF',
  descricao: '',
  preco: 20,
  imagemUrl: null,
  categoriaId: null,
  categoriaNome: null,
  unidadeId: null,
  unidadeCodigo: 1,
};

const gravados: NovoEnvio[] = [];

class LojasFalsas extends Lojas {
  override async buscar(id: string) {
    return id === LOJA ? { id, companyId: 'c0000000-0000-4000-8000-000000000000', nome: 'EASY SOFT' } : null;
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
class ComandasFalsas extends Comandas {
  override async registrarEnvio(envio: NovoEnvio) {
    gravados.push(envio);
    return { id: 'e', numero: 100 + gravados.length, comandaId: 'c' };
  }
  override async enviosDaMesa(): Promise<EnvioDaMesa[]> {
    return [];
  }
}

@Module({
  imports: [ConfigModule, ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }])],
  controllers: [MesaController, AdminQrCodesController, CardapioController, PedidosController],
  providers: [
    MesaService,
    CardapioService,
    PedidosService,
    { provide: Lojas, useClass: LojasFalsas },
    { provide: Catalogo, useClass: CatalogoFalso },
    { provide: Comandas, useClass: ComandasFalsas },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class ModuloDeTeste {}

let app: INestApplication;
const token = gerarToken({ storeId: LOJA, mesa: '7' }, SEGREDO);
const envioValido = { cliente: 'Ana', itens: [{ produtoId: PRODUTO.id, quantidade: 2 }] };

beforeAll(async () => {
  app = await criarApp(ModuloDeTeste);
});
afterAll(() => app.close());
beforeEach(() => {
  gravados.length = 0;
});

describe('mesa', () => {
  it('QR válido abre a mesa com o nome do restaurante', async () => {
    const r = await request(app.getHttpServer()).get(`/api/v1/mesas/${token}`).expect(200);
    expect(r.body).toEqual({ mesa: '7', restaurante: 'EASY SOFT' });
  });

  it('QR de loja inexistente ou adulterado dá 404 com mensagem em PT-BR', async () => {
    const deOutraLoja = gerarToken({ storeId: OUTRA_LOJA, mesa: '7' }, SEGREDO);
    for (const t of [deOutraLoja, `${token}x`, 'lixo']) {
      const r = await request(app.getHttpServer()).get(`/api/v1/mesas/${t}`).expect(404);
      expect(r.body.error).toBe('qr_invalido');
      expect(r.body.message).toMatch(/QR code inválido/);
    }
  });
});

describe('cardápio', () => {
  it('produto sem grupo cai na categoria "Cardápio"', async () => {
    const r = await request(app.getHttpServer()).get(`/api/v1/mesas/${token}/cardapio`).expect(200);
    expect(r.body.categorias).toEqual([{ id: 'outros', nome: 'Cardápio' }]);
    expect(r.body.produtos[0]).toMatchObject({ id: PRODUTO.id, preco: 20, categoriaId: 'outros' });
    expect(r.body.produtos[0]).not.toHaveProperty('codigoDeBarras');
  });
});

describe('envio de pedido', () => {
  it('grava com o preço do cadastro, ignorando qualquer preço mandado pelo celular', async () => {
    const r = await request(app.getHttpServer())
      .post(`/api/v1/mesas/${token}/pedidos`)
      .send({ ...envioValido, itens: [{ produtoId: PRODUTO.id, quantidade: 2, preco: 0.01 }] })
      .expect(201);
    expect(r.body).toEqual({ numero: 101, total: 40 });
    expect(gravados[0]).toMatchObject({ storeId: LOJA, mesa: '7', cliente: 'Ana', total: 40 });
    expect(gravados[0]!.itens[0]!.precoUnitario).toBe(20);
  });

  it.each([
    ['sem nome', { ...envioValido, cliente: ' ' }],
    ['sem itens', { ...envioValido, itens: [] }],
    ['quantidade zero', { ...envioValido, itens: [{ produtoId: PRODUTO.id, quantidade: 0 }] }],
    ['quantidade fracionada', { ...envioValido, itens: [{ produtoId: PRODUTO.id, quantidade: 1.5 }] }],
    ['produto não-uuid', { ...envioValido, itens: [{ produtoId: '1', quantidade: 1 }] }],
  ])('recusa %s com 422', async (_nome, corpo) => {
    const r = await request(app.getHttpServer()).post(`/api/v1/mesas/${token}/pedidos`).send(corpo).expect(422);
    expect(r.body.error).toBe('dados_invalidos');
    expect(gravados).toHaveLength(0);
  });

  it('produto de outra loja (ou desativado) não entra', async () => {
    const r = await request(app.getHttpServer())
      .post(`/api/v1/mesas/${token}/pedidos`)
      .send({ ...envioValido, itens: [{ produtoId: OUTRA_LOJA, quantidade: 1 }] })
      .expect(422);
    expect(r.body.error).toBe('produto_indisponivel');
    expect(gravados).toHaveLength(0);
  });

  it('corpo acima de 32 KB é recusado antes de chegar na regra', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/mesas/${token}/pedidos`)
      .send({ ...envioValido, observacao: 'x'.repeat(40_000) })
      .expect(413);
  });
});

describe('admin de QR codes', () => {
  it('sem a chave dá 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/admin/qrcodes').send({ storeId: LOJA, mesas: ['1'] }).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/admin/qrcodes')
      .set('X-Admin-Key', 'errada')
      .send({ storeId: LOJA, mesas: ['1'] })
      .expect(401);
  });

  it('com a chave gera links que a própria API aceita', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/admin/qrcodes')
      .set('X-Admin-Key', CHAVE)
      .send({ storeId: LOJA, mesas: ['01', '2', '2'] })
      .expect(200);
    expect(r.body.qrcodes.map((q: { mesa: string }) => q.mesa)).toEqual(['1', '2']);
    expect(r.body.qrcodes[0].url).toMatch(/^https:\/\/menu\.exemplo\.com\/mesa\/[\w-]+\.[\w-]+$/);
    await request(app.getHttpServer()).get(`/api/v1/mesas/${r.body.qrcodes[1].token}`).expect(200);
  });
});

describe('borda HTTP', () => {
  it('rota fora do prefixo responde 404 em JSON', async () => {
    const r = await request(app.getHttpServer()).get('/qualquer').expect(404);
    expect(r.body).toMatchObject({ statusCode: 404 });
  });

  it('envio tem limite de 10 por minuto por IP', async () => {
    let ultimo = 0;
    for (let i = 0; i < 11; i++) {
      ultimo = (await request(app.getHttpServer()).post(`/api/v1/mesas/${token}/pedidos`).send(envioValido)).status;
    }
    expect(ultimo).toBe(429);
  });
});
