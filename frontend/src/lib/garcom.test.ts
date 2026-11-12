import { describe, expect, it } from 'vitest';
import type { ProdutoDoCardapio, ResumoDaMesa } from './api';
import { itensParaEnviar, mudarObservacao, mudarQuantidade, ordenarMesas, prontosNovos, resumoDoPedido } from './garcom';

const produto = (id: string, preco: number): ProdutoDoCardapio => ({ id, nome: id, descricao: '', preco, imagemUrl: null, categoriaId: 'outros' });
const mesa = (m: string): ResumoDaMesa => ({ mesa: m, abertaEm: '', ultimoPedidoEm: '', pedidos: 1, naCozinha: 0, prontos: 0, total: 0 });

describe('prontos novos', () => {
  it('na primeira leitura não avisa (o app acabou de abrir); depois, só o que apareceu', () => {
    expect(prontosNovos(null, [{ id: 'a' }])).toEqual([]);
    expect(prontosNovos(new Set(['a']), [{ id: 'a' }, { id: 'b' }])).toEqual(['b']);
    expect(prontosNovos(new Set(['a', 'b']), [{ id: 'b' }])).toEqual([]);
  });
});

describe('mesas', () => {
  it('ordem numérica, com nomes no fim', () => {
    expect(ordenarMesas(['10', 'VIP1', '2', '1'].map(mesa)).map((m) => m.mesa)).toEqual(['1', '2', '10', 'VIP1']);
  });
});

describe('pedido do garçom', () => {
  it('soma, limita a 99 e tira a linha quando chega a zero', () => {
    let p = mudarQuantidade({}, 'a', 1);
    p = mudarQuantidade(p, 'a', 1);
    expect(p).toEqual({ a: { quantidade: 2, observacao: '' } });
    expect(mudarQuantidade(p, 'a', 200).a!.quantidade).toBe(99);
    expect(mudarQuantidade(p, 'a', -2)).toEqual({});
  });

  it('observação só em produto que está no pedido, até 140 caracteres', () => {
    const p = mudarQuantidade({}, 'a', 1);
    expect(mudarObservacao(p, 'b', 'sem gelo')).toBe(p);
    expect(mudarObservacao(p, 'a', 'x'.repeat(200)).a!.observacao).toHaveLength(140);
  });

  it('total em centavos e corpo na ordem do cardápio, sem observação vazia', () => {
    const produtos = [produto('a', 0.1), produto('b', 32.5)];
    let p = mudarQuantidade({}, 'b', 2);
    p = mudarQuantidade(p, 'a', 3);
    p = mudarObservacao(p, 'b', '  sem sal ');
    expect(resumoDoPedido(p, produtos)).toEqual({ itens: 5, total: 65.3 });
    expect(itensParaEnviar(p, produtos)).toEqual([
      { produtoId: 'a', quantidade: 3 },
      { produtoId: 'b', quantidade: 2, observacao: 'sem sal' },
    ]);
  });
});
