/**
 * Regras da tela da cozinha e dos avisos ao cliente, sem React — testadas em cozinha.test.ts.
 */
import type { PedidoNaCozinha, StatusNaCozinha } from './api';

export type NivelDeEspera = 'ok' | 'atencao' | 'atrasado';

/** Mesmos limites do protótipo: 8 min fica amarelo, 15 min fica vermelho. */
export function nivelDeEspera(minutos: number): NivelDeEspera {
  if (minutos >= 15) return 'atrasado';
  if (minutos >= 8) return 'atencao';
  return 'ok';
}

export const minutosDesde = (iso: string, agora: number) =>
  Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));

/** As três colunas da tela, cada uma do pedido mais antigo para o mais novo. */
export function separarPorEtapa(pedidos: PedidoNaCozinha[]) {
  const antigoPrimeiro = (a: PedidoNaCozinha, b: PedidoNaCozinha) => a.criadoEm.localeCompare(b.criadoEm);
  return {
    novos: pedidos.filter((p) => p.status === 'recebido').sort(antigoPrimeiro),
    emPreparo: pedidos.filter((p) => p.status === 'em_preparo').sort(antigoPrimeiro),
    // Prontos: o último que ficou pronto primeiro (é o que o cozinheiro quer desfazer, se errou).
    prontos: pedidos
      .filter((p) => p.status === 'pronto')
      .sort((a, b) => (b.prontoEm ?? '').localeCompare(a.prontoEm ?? '')),
  };
}

/** Ids que apareceram agora e não estavam na leitura anterior (para destacar e bipar). */
export function idsNovos(anteriores: ReadonlySet<string> | null, atuais: PedidoNaCozinha[]): string[] {
  if (!anteriores) return [];
  return atuais.filter((p) => p.status === 'recebido' && !anteriores.has(p.id)).map((p) => p.id);
}

/** Próxima etapa (botão principal do card) e a anterior (Desfazer). */
export const PROXIMA: Record<StatusNaCozinha, StatusNaCozinha | null> = {
  recebido: 'em_preparo',
  em_preparo: 'pronto',
  pronto: null,
  entregue: null,
};
export const ANTERIOR: Record<StatusNaCozinha, StatusNaCozinha | null> = {
  recebido: null,
  em_preparo: 'recebido',
  pronto: 'em_preparo',
  entregue: null,
};

/**
 * Para o celular do cliente: quais pedidos avançaram desde a última leitura. Só avisa de avanço
 * (recebido → em preparo → pronto); o "desfazer" da cozinha não gera aviso.
 */
export function avancos(
  anteriores: ReadonlyMap<string, StatusNaCozinha> | null,
  atuais: { id: string; numero: number; status: StatusNaCozinha }[],
): { numero: number; status: 'em_preparo' | 'pronto' }[] {
  if (!anteriores) return [];
  const ordem: StatusNaCozinha[] = ['recebido', 'em_preparo', 'pronto', 'entregue'];
  return atuais.flatMap((p) => {
    const antes = anteriores.get(p.id);
    // "Entregue" o cliente vê com os próprios olhos: o prato chega na mesa.
    if (!antes || ordem.indexOf(p.status) <= ordem.indexOf(antes) || p.status === 'recebido' || p.status === 'entregue') return [];
    return [{ numero: p.numero, status: p.status }];
  });
}
