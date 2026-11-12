/**
 * Único ponto do front que faz requisição. Tudo vai para /api/v1 do próprio site, que o Next
 * repassa à API NestJS (next.config.ts).
 */

/** `entregue`: o garçom levou à mesa (fase 4). */
export type StatusNaCozinha = 'recebido' | 'em_preparo' | 'pronto' | 'entregue';

export interface ProdutoDoCardapio {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagemUrl: string | null;
  categoriaId: string;
}

export interface Cardapio {
  restaurante: string;
  mesa: string;
  categorias: { id: string; nome: string }[];
  produtos: ProdutoDoCardapio[];
}

export interface PedidoDaMesa {
  id: string;
  numero: number;
  cliente: string;
  observacao: string | null;
  status: StatusNaCozinha;
  criadoEm: string;
  total: number;
  itens: { nome: string; quantidade: number; precoUnitario: number; observacao: string | null; cancelado: boolean }[];
}

export interface EnvioDoPedido {
  cliente: string;
  observacao?: string;
  itens: { produtoId: string; quantidade: number; observacao?: string }[];
}

export type Papel = 'cozinha' | 'garcom';

export interface UsuarioDaEquipe {
  id: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
}

export interface PedidoNaCozinha {
  id: string;
  numero: number;
  mesa: string;
  cliente: string;
  observacao: string | null;
  status: StatusNaCozinha;
  criadoEm: string;
  iniciadoEm: string | null;
  prontoEm: string | null;
  itens: { nome: string; quantidade: number; observacao: string | null; cancelado: boolean }[];
}

// ---------- app do garçom ----------

export interface ResumoDaMesa {
  mesa: string;
  abertaEm: string;
  ultimoPedidoEm: string;
  pedidos: number;
  naCozinha: number;
  prontos: number;
  total: number;
}

export interface ProntoParaLevar {
  id: string;
  numero: number;
  mesa: string;
  cliente: string;
  prontoEm: string;
  itens: { nome: string; quantidade: number; observacao: string | null; cancelado: boolean }[];
}

/** Por que o garçom não pode corrigir o item (null = pode). */
export type Bloqueio = 'cozinha_ja_comecou' | 'item_ja_lancado' | 'item_cancelado';

export interface ItemNaMesa {
  orderItemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  observacao: string | null;
  cancelado: boolean;
  lancado: boolean;
  bloqueio: Bloqueio | null;
}

export interface PedidoNaMesa {
  id: string;
  numero: number;
  cliente: string;
  observacao: string | null;
  status: StatusNaCozinha;
  criadoEm: string;
  prontoEm: string | null;
  total: number;
  itens: ItemNaMesa[];
}

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/v1${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ErroDaApi(0, 'sem_conexao', 'Sem conexão. Verifique a internet do celular e tente de novo.');
  }
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroDaApi(
      resposta.status,
      corpo?.error ?? 'erro',
      typeof corpo?.message === 'string' ? corpo.message : 'Não foi possível concluir. Tente de novo.',
    );
  }
  return corpo as T;
}

const t = (token: string) => encodeURIComponent(token);
const sessao = (token: string) => ({ Authorization: `Bearer ${token}` });
const admin = (chave: string) => ({ 'X-Admin-Key': chave });

export const api = {
  abrirMesa: (token: string) => chamar<{ mesa: string; restaurante: string }>(`/mesas/${t(token)}`),
  cardapio: (token: string) => chamar<Cardapio>(`/mesas/${t(token)}/cardapio`),
  enviarPedido: (token: string, envio: EnvioDoPedido) =>
    chamar<{ numero: number; total: number }>(`/mesas/${t(token)}/pedidos`, {
      method: 'POST',
      body: JSON.stringify(envio),
    }),
  pedidosDaMesa: (token: string) =>
    chamar<{ mesa: string; total: number; pedidos: PedidoDaMesa[] }>(`/mesas/${t(token)}/pedidos`),
  gerarQrCodes: (chaveDeAdmin: string, storeId: string, mesas: string[]) =>
    chamar<{ restaurante: string; qrcodes: { mesa: string; url: string }[] }>('/admin/qrcodes', {
      method: 'POST',
      headers: admin(chaveDeAdmin),
      body: JSON.stringify({ storeId, mesas }),
    }),

  // ---------- equipe (cozinha; garçom na fase 4) ----------
  entrar: (login: string, senha: string) =>
    chamar<{ token: string; usuario: UsuarioDaEquipe; restaurante: string }>('/equipe/entrar', {
      method: 'POST',
      body: JSON.stringify({ login, senha }),
    }),
  eu: (token: string) =>
    chamar<{ usuario: Omit<UsuarioDaEquipe, 'ativo'>; restaurante: string }>('/equipe/eu', { headers: sessao(token) }),
  pedidosDaCozinha: (token: string) =>
    chamar<{ restaurante: string; agora: string; pedidos: PedidoNaCozinha[] }>('/cozinha/pedidos', {
      headers: sessao(token),
    }),
  mudarStatus: (token: string, envioId: string, de: StatusNaCozinha, para: StatusNaCozinha) =>
    chamar<{ status: StatusNaCozinha }>(`/cozinha/pedidos/${t(envioId)}/status`, {
      method: 'POST',
      headers: sessao(token),
      body: JSON.stringify({ de, para }),
    }),

  // ---------- app do garçom ----------
  painelDoGarcom: (token: string) =>
    chamar<{ restaurante: string; agora: string; prontos: ProntoParaLevar[]; mesas: ResumoDaMesa[] }>('/garcom/painel', {
      headers: sessao(token),
    }),
  mesaDoGarcom: (token: string, mesa: string) =>
    chamar<{ mesa: string; total: number; pedidos: PedidoNaMesa[] }>(`/garcom/mesas/${t(mesa)}`, { headers: sessao(token) }),
  cardapioDoGarcom: (token: string) =>
    chamar<Omit<Cardapio, 'mesa'>>('/garcom/cardapio', { headers: sessao(token) }),
  pedirPeloGarcom: (token: string, mesa: string, envio: Omit<EnvioDoPedido, 'cliente'> & { cliente?: string }) =>
    chamar<{ numero: number; total: number }>(`/garcom/mesas/${t(mesa)}/pedidos`, {
      method: 'POST',
      headers: sessao(token),
      body: JSON.stringify(envio),
    }),
  corrigirItem: (token: string, envioId: string, orderItemId: string, quantidade: number) =>
    chamar<{ quantidade: number }>(`/garcom/pedidos/${t(envioId)}/itens/${t(orderItemId)}`, {
      method: 'PATCH',
      headers: sessao(token),
      body: JSON.stringify({ quantidade }),
    }),
  marcarEntregue: (token: string, envioId: string) =>
    chamar<{ status: 'entregue' }>(`/garcom/pedidos/${t(envioId)}/entregue`, { method: 'POST', headers: sessao(token) }),
  chaveDoPush: (token: string) => chamar<{ chavePublica: string | null }>('/garcom/push', { headers: sessao(token) }),
  inscreverPush: (token: string, inscricao: PushSubscriptionJSON) =>
    chamar<{ inscrito: boolean }>('/garcom/push', { method: 'POST', headers: sessao(token), body: JSON.stringify(inscricao) }),
  removerPush: (token: string, endpoint: string) =>
    chamar<{ inscrito: boolean }>('/garcom/push/remover', {
      method: 'POST',
      headers: sessao(token),
      body: JSON.stringify({ endpoint }),
    }),

  // ---------- administração da equipe ----------
  listarEquipe: (chave: string, storeId: string) =>
    chamar<{ restaurante: string; usuarios: UsuarioDaEquipe[] }>(`/admin/equipe?storeId=${t(storeId)}`, {
      headers: admin(chave),
    }),
  criarUsuario: (chave: string, dados: { storeId: string; nome: string; login: string; senha: string; papel: Papel }) =>
    chamar<UsuarioDaEquipe>('/admin/equipe', { method: 'POST', headers: admin(chave), body: JSON.stringify(dados) }),
  alterarUsuario: (chave: string, id: string, dados: { storeId: string; nome?: string; senha?: string; ativo?: boolean }) =>
    chamar<UsuarioDaEquipe>(`/admin/equipe/${t(id)}`, { method: 'PATCH', headers: admin(chave), body: JSON.stringify(dados) }),
};
