import type { StatusNaCozinha } from '../../pedidos/domain/pedido';

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
  /** `cancelado`: o item foi cancelado na comanda (caixa, Manager ou garçom) depois do envio. */
  itens: { nome: string; quantidade: number; observacao: string | null; cancelado: boolean }[];
}

/** O pedido que mudou de etapa (para avisar o garçom quando fica pronto). */
export interface PedidoMudado {
  numero: number;
  mesa: string;
  cliente: string;
}

export type ResultadoDaMudanca = PedidoMudado | 'nao_encontrado' | 'status_mudou';

/** Fila da cozinha de uma loja, lida e atualizada em cardapio.envios. */
export abstract class FilaDaCozinha {
  /**
   * Pendentes (recebido/em preparo) e os prontos recentes, do mais antigo para o mais novo. O que o
   * garçom já entregou e o envio com todos os itens cancelados não aparecem.
   */
  abstract listar(storeId: string): Promise<PedidoNaCozinha[]>;
  /**
   * Muda o status só se ainda estiver em `de` (outra tela pode ter mexido antes). Grava a hora
   * de início/pronto e o `updated_at` — o sincronizador leva a mudança para a loja por ele.
   */
  abstract mudarStatus(
    storeId: string,
    envioId: string,
    de: StatusNaCozinha,
    para: StatusNaCozinha,
  ): Promise<ResultadoDaMudanca>;
}
