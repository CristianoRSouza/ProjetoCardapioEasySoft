import { describe, expect, it } from 'vitest';
import type { PedidoNaCozinha } from './api';
import { avancos, idsNovos, minutosDesde, nivelDeEspera, separarPorEtapa } from './cozinha';

const pedido = (id: string, status: PedidoNaCozinha['status'], criadoEm: string, prontoEm: string | null = null): PedidoNaCozinha => ({
  id, numero: 100, mesa: '1', cliente: 'Ana', observacao: null, status, criadoEm, iniciadoEm: null, prontoEm, itens: [],
});

describe('tela da cozinha', () => {
  it('espera: até 7 min ok, de 8 a 14 atenção, 15 ou mais atrasado', () => {
    expect([0, 7, 8, 14, 15, 60].map(nivelDeEspera)).toEqual(['ok', 'ok', 'atencao', 'atencao', 'atrasado', 'atrasado']);
  });

  it('minutos desde: nunca negativo (relógio da TV adiantado)', () => {
    const agora = Date.parse('2026-11-09T20:10:30Z');
    expect(minutosDesde('2026-11-09T20:00:00Z', agora)).toBe(10);
    expect(minutosDesde('2026-11-09T20:11:00Z', agora)).toBe(0);
  });

  it('separa em colunas: pendentes do mais antigo, prontos do último pronto', () => {
    const { novos, emPreparo, prontos } = separarPorEtapa([
      pedido('b', 'recebido', '2026-11-09T20:05:00Z'),
      pedido('a', 'recebido', '2026-11-09T20:01:00Z'),
      pedido('c', 'em_preparo', '2026-11-09T19:00:00Z'),
      pedido('p1', 'pronto', '2026-11-09T18:00:00Z', '2026-11-09T19:00:00Z'),
      pedido('p2', 'pronto', '2026-11-09T18:30:00Z', '2026-11-09T19:30:00Z'),
    ]);
    expect(novos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(emPreparo.map((p) => p.id)).toEqual(['c']);
    expect(prontos.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('pedido novo só é "novo" a partir da segunda leitura (abrir a tela não bipa tudo)', () => {
    const lista = [pedido('a', 'recebido', '2026-11-09T20:00:00Z')];
    expect(idsNovos(null, lista)).toEqual([]);
    expect(idsNovos(new Set(['a']), lista)).toEqual([]);
    expect(idsNovos(new Set(), lista)).toEqual(['a']);
    // Desfazer de "em preparo" para "recebido" não conta como pedido novo.
    expect(idsNovos(new Set(['a']), [pedido('a', 'recebido', '2026-11-09T20:00:00Z')])).toEqual([]);
  });
});

describe('avisos no celular do cliente', () => {
  it('avisa quando o pedido começa e quando fica pronto, só uma vez', () => {
    const antes = new Map([['x', 'recebido' as const], ['y', 'em_preparo' as const]]);
    expect(
      avancos(antes, [
        { id: 'x', numero: 101, status: 'em_preparo' },
        { id: 'y', numero: 102, status: 'pronto' },
      ]),
    ).toEqual([{ numero: 101, status: 'em_preparo' }, { numero: 102, status: 'pronto' }]);
    expect(avancos(new Map([['x', 'em_preparo' as const]]), [{ id: 'x', numero: 101, status: 'em_preparo' }])).toEqual([]);
  });

  it('não avisa na primeira leitura, em pedido recém-enviado nem quando a cozinha desfaz', () => {
    expect(avancos(null, [{ id: 'x', numero: 101, status: 'pronto' }])).toEqual([]);
    expect(avancos(new Map(), [{ id: 'x', numero: 101, status: 'recebido' }])).toEqual([]);
    expect(avancos(new Map([['x', 'pronto' as const]]), [{ id: 'x', numero: 101, status: 'em_preparo' }])).toEqual([]);
  });
});
