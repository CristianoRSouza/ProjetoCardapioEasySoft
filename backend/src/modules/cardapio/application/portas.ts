export interface Produto {
  id: string;
  codigoDeBarras: string;
  nome: string;
  descricao: string;
  /** Preço de venda já arredondado a centavos. */
  preco: number;
  imagemUrl: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  unidadeId: string | null;
  /** pv_product_units.legacy_code — vai em order_items.unit_code, como o totem grava. */
  unidadeCodigo: number | null;
}

/** Produtos do EasyFood (public.pv_products) que podem ser vendidos pela loja. */
export abstract class Catalogo {
  /** Ativos, não excluídos e com preço > 0. */
  abstract listar(storeId: string): Promise<Produto[]>;
  /** Mesmo filtro de `listar`; ids que não passam simplesmente não voltam. */
  abstract buscarPorIds(storeId: string, ids: string[]): Promise<Produto[]>;
}
