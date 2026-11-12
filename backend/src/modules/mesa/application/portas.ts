export interface Loja {
  id: string;
  companyId: string;
  nome: string;
}

/** Lojas cadastradas no EasyFood (public.pv_stores). */
export abstract class Lojas {
  /** Só devolve loja ativa e não excluída. */
  abstract buscar(storeId: string): Promise<Loja | null>;
}
