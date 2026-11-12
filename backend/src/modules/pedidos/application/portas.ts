import type { ItemCalculado, StatusNaCozinha } from '../domain/pedido';

export interface NovoEnvio {
  companyId: string;
  storeId: string;
  mesa: string;
  cliente: string;
  observacao: string | null;
  itens: ItemCalculado[];
  total: number;
  /** Lançado pelo app do garçom; null quando veio do QR do cliente. */
  garcomId: string | null;
}

export interface EnvioRegistrado {
  id: string;
  numero: number;
  comandaId: string;
}

/** Item como está AGORA na comanda (o caixa ou o garçom podem ter mudado depois do envio). */
export interface ItemDoEnvio {
  orderItemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  observacao: string | null;
  cancelado: boolean;
  /** Já lançado no caixa (Firebird) pela loja: a partir daí só o caixa mexe nele. */
  lancado: boolean;
}

export interface EnvioDaMesa {
  id: string;
  numero: number;
  cliente: string;
  observacao: string | null;
  status: StatusNaCozinha;
  criadoEm: string;
  prontoEm: string | null;
  /** Soma dos itens não cancelados. */
  total: number;
  itens: ItemDoEnvio[];
}

/**
 * Comandas do EasyFood (command.orders / command.order_items) + o registro de cada envio do
 * cardápio (cardapio.envios). Uma mesa tem UMA comanda aberta; cada envio acrescenta itens nela.
 */
export abstract class Comandas {
  abstract registrarEnvio(envio: NovoEnvio): Promise<EnvioRegistrado>;
  /** Envios da comanda ABERTA da mesa, do mais antigo ao mais novo. Fechada a conta, a lista some. */
  abstract enviosDaMesa(storeId: string, mesa: string): Promise<EnvioDaMesa[]>;
}
