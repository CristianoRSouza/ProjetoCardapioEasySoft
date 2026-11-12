/**
 * Regras do app do garçom, sem React — testadas em garcom.test.ts.
 */
import type { Bloqueio, ProdutoDoCardapio, ResumoDaMesa } from './api';

/** Prontos que apareceram desde a última leitura (para bipar, vibrar e destacar). */
export function prontosNovos(anteriores: ReadonlySet<string> | null, atuais: { id: string }[]): string[] {
  if (!anteriores) return [];
  return atuais.filter((p) => !anteriores.has(p.id)).map((p) => p.id);
}

/** "2", "10", "VIP1": números em ordem numérica primeiro, depois os nomes. */
export function ordenarMesas(mesas: ResumoDaMesa[]): ResumoDaMesa[] {
  return [...mesas].sort((a, b) => a.mesa.localeCompare(b.mesa, 'pt-BR', { numeric: true }));
}

export const MOTIVO_DO_BLOQUEIO: Record<Bloqueio, string> = {
  cozinha_ja_comecou: 'A cozinha já começou — para cancelar, use o caixa',
  item_ja_lancado: 'Já lançado no caixa — corrija pelo caixa',
  item_cancelado: 'Cancelado',
};

// ---------- pedido que o garçom monta para a mesa ----------

export interface LinhaDoGarcom {
  quantidade: number;
  observacao: string;
}

export type PedidoDoGarcom = Readonly<Record<string, LinhaDoGarcom>>;

/** Soma `delta` à quantidade do produto (1 a 99); chegando a 0 a linha sai do pedido. */
export function mudarQuantidade(pedido: PedidoDoGarcom, produtoId: string, delta: number): PedidoDoGarcom {
  const atual = pedido[produtoId];
  const quantidade = Math.min(99, (atual?.quantidade ?? 0) + delta);
  if (quantidade <= 0) {
    const resto = { ...pedido };
    delete resto[produtoId];
    return resto;
  }
  return { ...pedido, [produtoId]: { quantidade, observacao: atual?.observacao ?? '' } };
}

export function mudarObservacao(pedido: PedidoDoGarcom, produtoId: string, observacao: string): PedidoDoGarcom {
  const atual = pedido[produtoId];
  return atual ? { ...pedido, [produtoId]: { ...atual, observacao: observacao.slice(0, 140) } } : pedido;
}

/** Total e quantidade de itens, pelo preço do cardápio (a API recalcula pelo cadastro ao gravar). */
export function resumoDoPedido(pedido: PedidoDoGarcom, produtos: ProdutoDoCardapio[]) {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  let itens = 0;
  let centavos = 0;
  for (const [id, linha] of Object.entries(pedido)) {
    const p = porId.get(id);
    if (!p) continue;
    itens += linha.quantidade;
    centavos += Math.round(p.preco * 100) * linha.quantidade;
  }
  return { itens, total: centavos / 100 };
}

/** O corpo que vai para a API, na ordem do cardápio. */
export function itensParaEnviar(pedido: PedidoDoGarcom, produtos: ProdutoDoCardapio[]) {
  return produtos
    .filter((p) => pedido[p.id])
    .map((p) => {
      const { quantidade, observacao } = pedido[p.id]!;
      return { produtoId: p.id, quantidade, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) };
    });
}
