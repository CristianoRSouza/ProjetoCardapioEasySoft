import { describe, expect, it } from 'vitest';
import { adicionarLinha, quantidadeDeItens, totalDoCarrinho } from './carrinho';
import { expandirMesas } from './formatar';

const batata = { id: 'b', nome: 'Batata', preco: 0.1, imagemUrl: null };

describe('carrinho', () => {
  it('mesmo produto e mesma observação somam na mesma linha', () => {
    let linhas = adicionarLinha([], batata, 1, 'sem sal');
    linhas = adicionarLinha(linhas, batata, 2, '  sem sal ');
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.quantidade).toBe(3);
  });

  it('observação diferente abre outra linha', () => {
    const linhas = adicionarLinha(adicionarLinha([], batata, 1, 'sem sal'), batata, 1);
    expect(linhas).toHaveLength(2);
    expect(quantidadeDeItens(linhas)).toBe(2);
  });

  it('total em centavos sem erro de ponto flutuante', () => {
    const linhas = adicionarLinha([], batata, 3);
    expect(totalDoCarrinho(linhas)).toBe(0.3);
  });

  it('quantidade não passa de 99', () => {
    expect(adicionarLinha(adicionarLinha([], batata, 98), batata, 5)[0]!.quantidade).toBe(99);
  });
});

describe('expandirMesas', () => {
  it('aceita faixas e listas, sem repetir', () => {
    expect(expandirMesas('1-3, 5 3;A1')).toEqual(['1', '2', '3', '5', 'A1']);
    expect(expandirMesas('5-3')).toEqual(['3', '4', '5']);
  });
});
