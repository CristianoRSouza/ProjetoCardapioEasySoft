// PASSO 7 — Teste de ponta a ponta do ambiente montado, pela API publicada (o mesmo roteiro que
// validou as fases 1, 3 e 4 na homologação).
//
//   cliente pede pelo QR → garçom corrige e cancela → garçom lança pedido → cozinha inicia
//   (correção passa a ser recusada) → pronto → garçom entrega → (opcional) a loja recebeu.
//
// ⚠ CRIA DADOS DE VERDADE no ambiente: uma comanda aberta MESA-<MESA> com itens, que o Sync leva à
//   loja e o caixa pode lançar no Firebird. Use em HOMOLOGAÇÃO. No fim, a comanda fica aberta: feche
//   ou cancele pelo caixa/Manager. Os usuários de teste (teste.garcom / teste.cozinha) são
//   desativados no fim.
//
// Uso (Node 22+; na raiz do projeto, depois de `npm install` no backend):
//   API_URL=https://menu-hml.exemplo.com.br/api/v1   ← endereço da API (ou do site, que repassa /api/v1)
//   ADMIN_API_KEY=...                                ← a do .env da API (passo 4)
//   STORE_ID=<uuid da loja em pv_stores>
//   CONFIRMO_DADOS_DE_TESTE=sim
//   [MESA=TESTE]                                     ← mesa usada (padrão TESTE)
//   [SITE_URL=https://menu-hml.exemplo.com.br]       ← confere também o site e o repasse /api/v1
//   [LOJA_DATABASE_URL=postgresql://...]             ← Postgres da loja: confere a chegada pelo Sync
//   node implantacao/7-testar-ambiente.mjs
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = process.env.API_URL?.replace(/\/$/, '');
const CHAVE = process.env.ADMIN_API_KEY;
const LOJA = process.env.STORE_ID;
const MESA = process.env.MESA || 'TESTE';
const SITE = process.env.SITE_URL?.replace(/\/$/, '');
const LOJA_DB = process.env.LOJA_DATABASE_URL;
if (!API || !CHAVE || !LOJA) {
  console.error('Defina API_URL, ADMIN_API_KEY e STORE_ID (ver o cabeçalho deste arquivo).');
  process.exit(2);
}
if (process.env.CONFIRMO_DADOS_DE_TESTE !== 'sim') {
  console.error('Este teste cria uma comanda de verdade na loja. Rode com CONFIRMO_DADOS_DE_TESTE=sim (só em homologação).');
  process.exit(2);
}

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
  return cond;
};
const aviso = (msg) => console.log(`AVISO ${msg}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const chamar = async (rota, { metodo = 'GET', cabecalhos = {}, corpo } = {}) => {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...cabecalhos },
    body: corpo && JSON.stringify(corpo),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const admin = { 'x-admin-key': CHAVE };

async function membroDeTeste(login, papel, nome) {
  const senha = crypto.randomBytes(12).toString('base64url');
  const criado = await chamar('/admin/equipe', { metodo: 'POST', cabecalhos: admin, corpo: { storeId: LOJA, nome, login, senha, papel } });
  const lista = (await chamar(`/admin/equipe?storeId=${LOJA}`, { cabecalhos: admin })).json?.usuarios ?? [];
  const usuario = lista.find((u) => u.login === login);
  if (criado.status === 409 && usuario) {
    await chamar(`/admin/equipe/${usuario.id}`, { metodo: 'PATCH', cabecalhos: admin, corpo: { storeId: LOJA, senha, ativo: true } });
  } else if (criado.status !== 201 && criado.status !== 200) {
    throw new Error(`não consegui cadastrar ${login}: ${criado.status} ${JSON.stringify(criado.json)}`);
  }
  const sessao = await chamar('/equipe/entrar', { metodo: 'POST', corpo: { login, senha } });
  if (!sessao.json?.token) throw new Error(`login de ${login} falhou: ${sessao.status}`);
  return { id: usuario?.id, h: { authorization: `Bearer ${sessao.json.token}` } };
}

// 0. API, banco e site
const vivo = await chamar('/health/live').catch((e) => ({ status: 0, json: String(e) }));
if (!ok(vivo.status === 200, `API no ar (${API})`)) process.exit(1);
const banco = await chamar('/health/db');
ok(banco.status === 200, 'API conecta no banco');
ok(banco.json?.role_restrito === true, 'API usa o usuário restrito easymenu_api (passo 3)');
if (SITE) {
  for (const [rota, o_que] of [['/garcom', 'app do garçom'], ['/sw-garcom.js', 'service worker do garçom'], ['/api/v1/health/live', 'repasse /api/v1 do site para a API (BACKEND_URL do build)']]) {
    const r = await fetch(SITE + rota).catch(() => null);
    ok(r?.status === 200, `site: ${o_que}`);
  }
}

// 1. equipe de teste
const garcom = await membroDeTeste('teste.garcom', 'garcom', 'Garçom de Teste');
const cozinha = await membroDeTeste('teste.cozinha', 'cozinha', 'Cozinha de Teste');
ok((await chamar('/garcom/painel', { cabecalhos: garcom.h })).status === 200, 'garçom entra no app');
const push = await chamar('/garcom/push', { cabecalhos: garcom.h });
if (!(push.json?.chavePublica?.length > 40)) aviso('push desligado: sem VAPID_* no .env da API (o garçom só é avisado com o app aberto)');
else ok(true, 'push ligado (chave VAPID)');

try {
  // 2. cliente pede pelo QR
  const qr = (await chamar('/admin/qrcodes', { metodo: 'POST', cabecalhos: admin, corpo: { storeId: LOJA, mesas: [MESA] } })).json?.qrcodes?.[0];
  if (!ok(Boolean(qr?.token), `QR code da mesa ${MESA}`)) throw new Error('sem QR');
  const produtos = (await chamar(`/mesas/${qr.token}/cardapio`)).json?.produtos ?? [];
  if (!ok(produtos.length >= 2, `cardápio com ${produtos.length} produto(s) (precisa de 2+ ativos com preço)`)) throw new Error('cardápio vazio');
  const [A, B] = produtos;
  const p1 = await chamar(`/mesas/${qr.token}/pedidos`, {
    metodo: 'POST',
    corpo: { cliente: 'Teste de Implantação', itens: [{ produtoId: A.id, quantidade: 2, observacao: 'teste' }, { produtoId: B.id, quantidade: 1 }] },
  });
  if (!ok(p1.status === 201, `cliente pediu #${p1.json?.numero}: 2x ${A.nome} + 1x ${B.nome}`)) throw new Error(JSON.stringify(p1.json));

  // 3. garçom corrige e cancela
  const envio = (await chamar(`/garcom/mesas/${encodeURIComponent(MESA)}`, { cabecalhos: garcom.h })).json?.pedidos?.find((p) => p.numero === p1.json.numero);
  if (!ok(Boolean(envio), 'garçom vê o pedido na mesa')) throw new Error('pedido não apareceu');
  const [ia, ib] = envio.itens;
  const item = (id) => `/garcom/pedidos/${envio.id}/itens/${id}`;
  ok((await chamar(item(ia.orderItemId), { metodo: 'PATCH', cabecalhos: garcom.h, corpo: { quantidade: 3 } })).status === 200, 'garçom corrigiu 2 → 3');
  ok((await chamar(item(ib.orderItemId), { metodo: 'PATCH', cabecalhos: garcom.h, corpo: { quantidade: 0 } })).status === 200, 'garçom cancelou o 2º item');
  const visto = (await chamar(`/mesas/${qr.token}/pedidos`)).json?.pedidos?.find((p) => p.id === envio.id);
  ok(visto?.itens?.[0]?.quantidade === 3 && visto?.itens?.[1]?.cancelado === true, `cliente vê a correção (total ${visto?.total})`);

  // 4. garçom lança um pedido na mesa
  const p2 = await chamar(`/garcom/mesas/${encodeURIComponent(MESA)}/pedidos`, { metodo: 'POST', cabecalhos: garcom.h, corpo: { itens: [{ produtoId: B.id, quantidade: 1 }] } });
  ok(p2.status === 201, `garçom lançou #${p2.json?.numero}`);

  // 5. cozinha → pronto → entregue
  const status = (de, para) => chamar(`/cozinha/pedidos/${envio.id}/status`, { metodo: 'POST', cabecalhos: cozinha.h, corpo: { de, para } });
  ok((await status('recebido', 'em_preparo')).status === 200, 'cozinha iniciou o preparo');
  ok((await chamar(item(ia.orderItemId), { metodo: 'PATCH', cabecalhos: garcom.h, corpo: { quantidade: 1 } })).json?.error === 'cozinha_ja_comecou', 'correção recusada depois de iniciado');
  ok((await status('em_preparo', 'pronto')).status === 200, 'cozinha marcou pronto');
  ok((await chamar('/garcom/painel', { cabecalhos: garcom.h })).json?.prontos?.some((p) => p.id === envio.id), 'pronto aparece para o garçom');
  ok((await chamar(`/garcom/pedidos/${envio.id}/entregue`, { metodo: 'POST', cabecalhos: garcom.h })).status === 200, 'garçom marcou entregue');

  // 6. (opcional) chegou à loja pelo Sync
  if (LOJA_DB) {
    const pg = createRequire(path.join(import.meta.dirname, '..', 'backend', 'package.json'))('pg');
    const loja = new pg.Client({ connectionString: LOJA_DB });
    await loja.connect();
    try {
      let linha;
      for (let i = 0; i < 30 && linha?.status !== 'entregue'; i++) {
        linha = (await loja.query('select status from cardapio.envios where id = $1', [envio.id])).rows[0];
        if (linha?.status !== 'entregue') await esperar(2000);
      }
      ok(linha?.status === 'entregue', 'loja recebeu o pedido e o "entregue" (Sync V2 + passo 5)');
      const itens = Object.fromEntries(
        (await loja.query('select id, quantity, status::text as status from public.order_items where id = any($1::uuid[])', [[ia.orderItemId, ib.orderItemId]])).rows.map((r) => [r.id, r]),
      );
      ok(itens[ia.orderItemId]?.quantity === 3 && itens[ib.orderItemId]?.status === 'cancelled', 'loja tem a correção e o cancelamento do garçom');
    } finally {
      await loja.end();
    }
  }
} catch (e) {
  ok(false, `teste interrompido: ${e.message}`);
} finally {
  // usuários de teste desativados (não dá para entrar com eles depois)
  const lista = (await chamar(`/admin/equipe?storeId=${LOJA}`, { cabecalhos: admin })).json?.usuarios ?? [];
  for (const u of lista.filter((x) => ['teste.garcom', 'teste.cozinha'].includes(x.login))) {
    await chamar(`/admin/equipe/${u.id}`, { metodo: 'PATCH', cabecalhos: admin, corpo: { storeId: LOJA, ativo: false } });
  }
}

console.log(falhas === 0 ? `\nTUDO OK — feche ou cancele a comanda MESA-${MESA} pelo caixa/Manager.` : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
