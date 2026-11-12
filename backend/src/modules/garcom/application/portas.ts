import type { Bloqueio } from '../domain/edicao';

export interface ResumoDaMesa {
  mesa: string;
  abertaEm: string;
  ultimoPedidoEm: string;
  pedidos: number;
  /** Recebidos + em preparo. */
  naCozinha: number;
  prontos: number;
  /** Itens ativos da comanda (inclui o que o caixa lançou nela). */
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

export interface AlteracaoDeItem {
  storeId: string;
  envioId: string;
  orderItemId: string;
  /** Nova quantidade; 0 cancela o item. */
  quantidade: number;
  usuarioId: string;
}

export type ResultadoDaAlteracao = 'ok' | 'nao_encontrado' | 'comanda_fechada' | Bloqueio;

/** O salão visto pelo garçom: mesas abertas do cardápio, prontos para levar e correções. */
export abstract class Salao {
  abstract mesasAbertas(storeId: string): Promise<ResumoDaMesa[]>;
  /** Prontos que ninguém marcou como entregues, do que ficou pronto há mais tempo ao mais novo. */
  abstract prontos(storeId: string): Promise<ProntoParaLevar[]>;
  /**
   * Corrige um item numa transação, travando o envio: a cozinha não consegue "Iniciar preparo" no
   * meio da correção. Atualiza a comanda, o retrato do envio e o total, e registra quem corrigiu.
   */
  abstract alterarItem(alteracao: AlteracaoDeItem): Promise<ResultadoDaAlteracao>;
  /** Só sai de "pronto": o que já foi entregue (por outro garçom) não muda. */
  abstract marcarEntregue(storeId: string, envioId: string): Promise<'ok' | 'nao_encontrado' | 'status_mudou'>;
}
