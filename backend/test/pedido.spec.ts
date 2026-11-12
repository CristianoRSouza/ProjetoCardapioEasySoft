import { describe, expect, it } from 'vitest';
import { ErroDeNegocio } from '../src/common/erros/erro-de-negocio';
import type { Produto } from '../src/modules/cardapio/application/portas';
import { calcularItens, codigoDaComandaDaMesa } from '../src/modules/pedidos/domain/pedido';

const produto = (id: string, preco: number): Produto => ({
  id,
  codigoDeBarras: id,
  nome: `Produto ${id}`,
  descricao: '',
  preco,
  imagemUrl: null,
  categoriaId: null,
  categoriaNome: null,
  unidadeId: null,
  unidadeCodigo: 1,
});

describe('calcularItens', () => {
  it('usa o preço do cadastro e soma em centavos sem erro de ponto flutuante', () => {
    const { itens, total } = calcularItens(
      [
        { produtoId: 'a', quantidade: 3 },
        { produtoId: 'b', quantidade: 1, observacao: '  sem gelo  ' },
      ],
      [produto('a', 0.1), produto('b', 0.2)],
    );
    expect(itens.map((i) => i.subtotal)).toEqual([0.3, 0.2]);
    expect(total).toBe(0.5);
    expect(itens[1]!.observacao).toBe('sem gelo');
    expect(itens[0]!.observacao).toBeNull();
  });

  it('produto indisponível derruba o envio inteiro com 422', () => {
    try {
      calcularItens([{ produtoId: 'a', quantidade: 1 }, { produtoId: 'sumiu', quantidade: 1 }], [produto('a', 10)]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeNegocio);
      expect((e as ErroDeNegocio).status).toBe(422);
      expect((e as ErroDeNegocio).codigo).toBe('produto_indisponivel');
    }
  });

  it('mesmo produto em duas linhas (observações diferentes) vira duas linhas', () => {
    const { itens, total } = calcularItens(
      [
        { produtoId: 'a', quantidade: 1, observacao: 'bem passado' },
        { produtoId: 'a', quantidade: 2 },
      ],
      [produto('a', 25.9)],
    );
    expect(itens).toHaveLength(2);
    expect(total).toBe(77.7);
  });

  it('código da comanda da mesa não colide com comanda física numérica', () => {
    expect(codigoDaComandaDaMesa('12')).toBe('MESA-12');
  });
});
