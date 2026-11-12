'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cabecalho, Carregando } from '@/components/cabecalho';
import { FotoDoProduto } from '@/components/foto-do-produto';
import { useCardapio } from '@/hooks/use-cardapio';
import { useExigirMesa } from '@/hooks/use-exigir-mesa';
import { QUANTIDADE_MAXIMA, useCarrinho } from '@/lib/carrinho';
import { formatarBRL } from '@/lib/formatar';

/**
 * Detalhe do produto: quantidade e observação do item ("sem cebola", "bem passado").
 * Os blocos "Adicionais" e "Retirar ingredientes" do protótipo dependem de um cadastro que ainda
 * não existe no EasyFood — ver docs/decisoes-pendentes.md.
 */
export default function TelaDoProduto() {
  const { id } = useParams<{ id: string }>();
  const sessao = useExigirMesa();
  const { cardapio, erro } = useCardapio(sessao?.token ?? null);
  const adicionar = useCarrinho((s) => s.adicionar);
  const router = useRouter();
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');

  if (!sessao || (!cardapio && !erro)) return <Carregando />;
  const produto = cardapio?.produtos.find((p) => p.id === id);

  if (!produto) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Cabecalho titulo="Detalhes" voltarPara="/cardapio" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center">
          {erro ?? 'Este produto não está mais disponível.'}
        </div>
      </div>
    );
  }

  const confirmar = () => {
    adicionar({ id: produto.id, nome: produto.nome, preco: produto.preco, imagemUrl: produto.imagemUrl }, quantidade, observacao);
    router.push('/cardapio');
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho titulo="Detalhes" voltarPara="/cardapio" />

      <main className="flex-1">
        <div className="aspect-[16/10] w-full relative overflow-hidden">
          <FotoDoProduto url={produto.imagemUrl} alt={produto.nome} className="w-full h-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <h1 className="font-display text-3xl uppercase tracking-tight text-white leading-[0.95]">{produto.nome}</h1>
            {produto.descricao && <p className="text-sm text-white/85 mt-1 line-clamp-3">{produto.descricao}</p>}
          </div>
        </div>

        <div className="p-4 space-y-5">
          <section>
            <div className="flex items-baseline justify-between">
              <label htmlFor="obs-item" className="font-display text-lg uppercase tracking-tight">
                Alguma observação?
              </label>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opcional</span>
            </div>
            <textarea
              id="obs-item"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Ex.: sem cebola, bem passado…"
              className="mt-3 w-full rounded-2xl bg-card border-2 border-border p-3 outline-none focus:border-brand-red resize-none"
            />
          </section>

          <section>
            <h2 className="font-display text-lg uppercase tracking-tight">Quantidade</h2>
            <div className="flex items-center justify-between bg-card border-2 border-border rounded-2xl p-2 mt-3">
              <button
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                disabled={quantidade <= 1}
                className="size-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
                aria-label="Diminuir"
              >
                <span aria-hidden className="text-3xl leading-none">−</span>
              </button>
              <span className="font-display text-3xl tabular-nums" aria-live="polite">
                {quantidade}
              </span>
              <button
                onClick={() => setQuantidade((q) => Math.min(QUANTIDADE_MAXIMA, q + 1))}
                className="size-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Aumentar"
              >
                <span aria-hidden className="text-3xl leading-none">+</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] grid grid-cols-[1fr_1.8fr] gap-3">
        <Link
          href="/cardapio"
          className="h-14 rounded-2xl bg-secondary text-secondary-foreground font-black uppercase text-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          Cancelar
        </Link>
        <button
          onClick={confirmar}
          className="h-14 rounded-2xl bg-brand-red text-primary-foreground flex items-center justify-between px-4 active:translate-y-0.5 transition-transform shadow-[0_5px_0_var(--brand-red-dark)] active:shadow-none"
        >
          <span className="text-sm font-black uppercase tracking-wide">Adicionar</span>
          <span className="font-display text-xl tabular-nums">{formatarBRL(produto.preco * quantidade)}</span>
        </button>
      </div>
    </div>
  );
}
