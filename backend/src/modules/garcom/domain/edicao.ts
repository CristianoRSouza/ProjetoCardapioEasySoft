import type { StatusNaCozinha } from '../../pedidos/domain/pedido';

/**
 * Quando o garçom pode corrigir um item (reunião de 05/11: "pode editar o pedido, depois de ver se
 * a cozinha já começou"). Corrigir = mudar a quantidade ou cancelar (quantidade 0).
 *
 *   * A cozinha ainda não começou o pedido. Depois disso, o prato pode já estar no fogo.
 *   * O item não foi lançado no caixa. Lançado, ele está no Firebird da loja, e desfazer o lançamento
 *     é com o caixa (o Sync não tira item do Firebird — easyFoodSyncV2/docs/decisoes-pendentes §3).
 *   * O item não está cancelado.
 */
export type Bloqueio = 'cozinha_ja_comecou' | 'item_ja_lancado' | 'item_cancelado';

export function bloqueioDoItem(statusDoPedido: StatusNaCozinha, item: { cancelado: boolean; lancado: boolean }): Bloqueio | null {
  if (item.cancelado) return 'item_cancelado';
  if (item.lancado) return 'item_ja_lancado';
  if (statusDoPedido !== 'recebido') return 'cozinha_ja_comecou';
  return null;
}

export const MENSAGEM_DO_BLOQUEIO: Record<Bloqueio, string> = {
  cozinha_ja_comecou: 'A cozinha já começou este pedido. Combine com a cozinha; para cancelar, use o caixa.',
  item_ja_lancado: 'Este item já foi lançado no caixa. Para corrigir, use o caixa.',
  item_cancelado: 'Este item já está cancelado.',
};

/** Prontos esperando o garçom: some da lista depois disso, mesmo sem "entregue". */
export const PRONTOS_PARA_LEVAR_HORAS = 12;

/** Mesa com envio mais velho que isto não aparece entre as abertas (comanda esquecida). */
export const JANELA_DAS_MESAS_HORAS = 48;
