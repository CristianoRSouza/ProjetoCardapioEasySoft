/**
 * Carrinho do cliente. Vive só no celular (sessionStorage) até o envio para a cozinha.
 * O preço guardado aqui é só para mostrar: a API recalcula tudo pelo cadastro ao enviar.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProdutoDoCardapio } from './api';

export interface LinhaDoCarrinho {
  linhaId: string;
  produto: Pick<ProdutoDoCardapio, 'id' | 'nome' | 'preco' | 'imagemUrl'>;
  quantidade: number;
  observacao: string;
}

interface EstadoDoCarrinho {
  linhas: LinhaDoCarrinho[];
  adicionar: (produto: LinhaDoCarrinho['produto'], quantidade?: number, observacao?: string) => void;
  aumentar: (linhaId: string) => void;
  diminuir: (linhaId: string) => void;
  limpar: () => void;
}

export const QUANTIDADE_MAXIMA = 99;

let contador = 0;
const novaLinhaId = () => `${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Mesmo produto com a mesma observação soma na mesma linha; observação diferente abre outra. */
export function adicionarLinha(
  linhas: LinhaDoCarrinho[],
  produto: LinhaDoCarrinho['produto'],
  quantidade = 1,
  observacao = '',
): LinhaDoCarrinho[] {
  const obs = observacao.trim();
  const existente = linhas.find((l) => l.produto.id === produto.id && l.observacao === obs);
  if (existente) {
    return linhas.map((l) =>
      l === existente ? { ...l, quantidade: Math.min(QUANTIDADE_MAXIMA, l.quantidade + quantidade) } : l,
    );
  }
  return [...linhas, { linhaId: novaLinhaId(), produto, quantidade: Math.min(QUANTIDADE_MAXIMA, quantidade), observacao: obs }];
}

export const subtotalDaLinha = (l: LinhaDoCarrinho) => Math.round(l.produto.preco * l.quantidade * 100) / 100;
export const totalDoCarrinho = (linhas: LinhaDoCarrinho[]) =>
  Math.round(linhas.reduce((s, l) => s + subtotalDaLinha(l), 0) * 100) / 100;
export const quantidadeDeItens = (linhas: LinhaDoCarrinho[]) => linhas.reduce((s, l) => s + l.quantidade, 0);

export const useCarrinho = create<EstadoDoCarrinho>()(
  persist(
    (set) => ({
      linhas: [],
      adicionar: (produto, quantidade, observacao) =>
        set((s) => ({ linhas: adicionarLinha(s.linhas, produto, quantidade, observacao) })),
      aumentar: (linhaId) =>
        set((s) => ({
          linhas: s.linhas.map((l) =>
            l.linhaId === linhaId ? { ...l, quantidade: Math.min(QUANTIDADE_MAXIMA, l.quantidade + 1) } : l,
          ),
        })),
      diminuir: (linhaId) =>
        set((s) => ({
          linhas: s.linhas
            .map((l) => (l.linhaId === linhaId ? { ...l, quantidade: l.quantidade - 1 } : l))
            .filter((l) => l.quantidade > 0),
        })),
      limpar: () => set({ linhas: [] }),
    }),
    { name: 'easymenu-carrinho', storage: createJSONStorage(() => (typeof window === 'undefined' ? undefined : sessionStorage)!) },
  ),
);
