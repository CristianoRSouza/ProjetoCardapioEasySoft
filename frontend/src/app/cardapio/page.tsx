'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cabecalho, Carregando, TelaCheia } from '@/components/cabecalho';
import { FotoDoProduto } from '@/components/foto-do-produto';
import { useCardapio } from '@/hooks/use-cardapio';
import { useExigirMesa } from '@/hooks/use-exigir-mesa';
import type { ProdutoDoCardapio } from '@/lib/api';
import { quantidadeDeItens, totalDoCarrinho, useCarrinho } from '@/lib/carrinho';
import { formatarBRL } from '@/lib/formatar';

export default function TelaDoCardapio() {
  const sessao = useExigirMesa();
  const { cardapio, erro, recarregar } = useCardapio(sessao?.token ?? null);
  const linhas = useCarrinho((s) => s.linhas);
  const adicionar = useCarrinho((s) => s.adicionar);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [adicionadoId, setAdicionadoId] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const [busca, setBusca] = useState('');

  const categorias = useMemo(() => cardapio?.categorias ?? [], [cardapio]);

  // Destaca a categoria visível durante a rolagem.
  useEffect(() => {
    if (!categorias.length) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setAtiva(visivel.target.id.replace('cat-', ''));
      },
      { rootMargin: '-120px 0px -65% 0px' },
    );
    categorias.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
  }, [categorias, busca]);

  useEffect(() => {
    chipsRef.current
      ?.querySelector<HTMLElement>(`[data-chip="${ativa}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [ativa]);

  if (!sessao) return <Carregando />;
  if (erro && !cardapio) {
    return (
      <TelaCheia>
        <p className="font-display text-3xl">Não carregou o cardápio</p>
        <p className="text-muted-foreground">{erro}</p>
        <button onClick={() => void recarregar()} className="h-12 px-6 rounded-xl bg-brand-red text-primary-foreground font-black">
          Tentar de novo
        </button>
      </TelaCheia>
    );
  }
  if (!cardapio) return <Carregando />;

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const produtosDa = (categoriaId: string) =>
    cardapio.produtos.filter(
      (p) => p.categoriaId === categoriaId && (!termo || `${p.nome} ${p.descricao}`.toLocaleLowerCase('pt-BR').includes(termo)),
    );
  const visiveis = categorias.filter((c) => produtosDa(c.id).length > 0);
  const quantidade = quantidadeDeItens(linhas);

  const irPara = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) window.scrollTo({ top: el.offsetTop - 112, behavior: 'smooth' });
  };

  const adicionarRapido = (p: ProdutoDoCardapio) => {
    adicionar({ id: p.id, nome: p.nome, preco: p.preco, imagemUrl: p.imagemUrl });
    setAdicionadoId(p.id);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAdicionadoId(null), 1000);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho
        direita={
          <Link href="/minha-mesa" className="h-8 px-2 text-xs font-bold text-muted-foreground underline flex items-center">
            Pedidos
          </Link>
        }
      />

      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-3 pt-2.5">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio"
            aria-label="Buscar no cardápio"
            className="w-full h-11 px-4 rounded-full bg-card border border-border outline-none focus:border-brand-red"
          />
        </div>
        {visiveis.length > 1 && (
          <nav aria-label="Categorias" ref={chipsRef} className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-2.5">
            {visiveis.map((c) => (
              <button
                key={c.id}
                data-chip={c.id}
                onClick={() => irPara(c.id)}
                className={`h-10 px-4 rounded-full text-sm font-bold whitespace-nowrap border transition-colors ${
                  ativa === c.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground border-border'
                }`}
              >
                {c.nome}
              </button>
            ))}
          </nav>
        )}
        {visiveis.length <= 1 && <div className="h-2.5" />}
      </div>

      <main className={`flex-1 px-3 pt-2 ${quantidade > 0 ? 'pb-28' : 'pb-8'}`}>
        {visiveis.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            {termo ? 'Nada encontrado com essa busca.' : 'O cardápio está vazio no momento.'}
          </p>
        )}
        {visiveis.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="pt-4">
            <h2 className="font-display text-3xl tracking-wide px-1 mb-2">{c.nome}</h2>
            <ul className="divide-y divide-border bg-card rounded-2xl border border-border overflow-hidden">
              {produtosDa(c.id).map((p) => (
                <li key={p.id} className="flex gap-3 p-3">
                  <Link href={`/produto/${p.id}`} className="flex-1 min-w-0 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold leading-tight text-foreground">{p.nome}</h3>
                      {p.descricao && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{p.descricao}</p>}
                      <p className="font-black mt-1.5 tabular-nums">{formatarBRL(p.preco)}</p>
                    </div>
                    <FotoDoProduto url={p.imagemUrl} className="size-24 rounded-xl shrink-0" />
                  </Link>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => adicionarRapido(p)}
                      aria-label={`Adicionar ${p.nome}`}
                      className={`size-11 rounded-full text-2xl flex items-center justify-center active:scale-90 transition-all ${
                        adicionadoId === p.id ? 'bg-success text-success-foreground' : 'bg-brand-red text-primary-foreground'
                      }`}
                    >
                      <span aria-hidden className={adicionadoId === p.id ? 'text-lg animate-check-pop' : ''}>
                        {adicionadoId === p.id ? '✓' : '+'}
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {quantidade > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-[480px] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/carrinho"
            className="h-16 rounded-2xl bg-brand-red text-primary-foreground shadow-2xl flex items-center justify-between px-5 active:scale-[0.98] transition-transform animate-cart-bump"
          >
            <span className="size-8 rounded-full bg-primary-foreground/20 font-black flex items-center justify-center tabular-nums">
              {quantidade}
            </span>
            <span className="font-black uppercase tracking-wider">Ver pedido</span>
            <span className="font-black tabular-nums">{formatarBRL(totalDoCarrinho(linhas))}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
