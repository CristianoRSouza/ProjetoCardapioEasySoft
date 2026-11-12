import { invalido } from '../../../common/erros/erro-de-negocio';
import type { Produto } from '../../cardapio/application/portas';

/** `entregue`: o garçom levou à mesa (fase 4). Quem marca é o app do garçom, não a cozinha. */
export type StatusNaCozinha = 'recebido' | 'em_preparo' | 'pronto' | 'entregue';

export interface ItemPedido {
  produtoId: string;
  quantidade: number;
  observacao?: string;
}

export interface ItemCalculado {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  observacao: string | null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Monta os itens com o preço do CADASTRO, nunca o que veio do celular. Produto inativo, excluído
 * ou de outra loja derruba o envio inteiro: o cliente vê o aviso e revisa o carrinho.
 */
export function calcularItens(itens: ItemPedido[], produtos: Produto[]): { itens: ItemCalculado[]; total: number } {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const faltando = itens.filter((i) => !porId.has(i.produtoId));
  if (faltando.length) {
    throw invalido(
      'produto_indisponivel',
      'Algum item do seu pedido não está mais disponível. Atualize o cardápio e revise o pedido.',
    );
  }
  const calculados = itens.map((i) => {
    const produto = porId.get(i.produtoId)!;
    return {
      produto,
      quantidade: i.quantidade,
      precoUnitario: produto.preco,
      subtotal: centavos(produto.preco * i.quantidade),
      observacao: i.observacao?.trim() || null,
    };
  });
  return { itens: calculados, total: centavos(calculados.reduce((s, i) => s + i.subtotal, 0)) };
}

/** Código da comanda da mesa em command.orders.barcode. Não colide com comandas físicas (numéricas). */
export const codigoDaComandaDaMesa = (mesa: string) => `MESA-${mesa}`;

/** Aparece na coluna "Totem" da tela de Comandas do Manager. */
export const ORIGEM_CARDAPIO = 'CARDAPIO-DIGITAL';
