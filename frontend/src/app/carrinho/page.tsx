'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cabecalho, Carregando } from '@/components/cabecalho';
import { FotoDoProduto } from '@/components/foto-do-produto';
import { invalidarCardapio } from '@/hooks/use-cardapio';
import { useExigirMesa } from '@/hooks/use-exigir-mesa';
import { api, ErroDaApi } from '@/lib/api';
import { subtotalDaLinha, totalDoCarrinho, useCarrinho } from '@/lib/carrinho';
import { formatarBRL } from '@/lib/formatar';

export default function TelaDoCarrinho() {
  const sessao = useExigirMesa();
  const { linhas, aumentar, diminuir, limpar } = useCarrinho();
  const [observacao, setObservacao] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  if (!sessao) return <Carregando />;

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const { numero } = await api.enviarPedido(sessao.token, {
        cliente: sessao.cliente,
        observacao: observacao.trim() || undefined,
        itens: linhas.map((l) => ({ produtoId: l.produto.id, quantidade: l.quantidade, observacao: l.observacao || undefined })),
      });
      limpar();
      router.replace(`/pedido-enviado?n=${numero}`);
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'produto_indisponivel') invalidarCardapio(sessao.token);
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível enviar. Tente novamente.');
      setEnviando(false);
    }
  };

  if (linhas.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col">
        <Cabecalho titulo="Seu pedido" voltarPara="/cardapio" />
        <main className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <p className="font-display text-3xl">Seu pedido está vazio</p>
          <p className="text-muted-foreground">Escolha algo gostoso no cardápio.</p>
          <Link href="/cardapio" className="h-12 px-6 rounded-xl bg-brand-red text-primary-foreground font-black flex items-center">
            Ver cardápio
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho titulo="Seu pedido" voltarPara="/cardapio" />
      <main className="flex-1 p-3 space-y-3 pb-44">
        <ul className="bg-card rounded-2xl border border-border divide-y divide-border">
          {linhas.map((l) => (
            <li key={l.linhaId} className="p-3 flex gap-3">
              <FotoDoProduto url={l.produto.imagemUrl} className="size-16 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{l.produto.nome}</p>
                {l.observacao && <p className="text-xs text-muted-foreground mt-0.5">Obs.: {l.observacao}</p>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center rounded-full border border-border">
                    <button
                      onClick={() => diminuir(l.linhaId)}
                      aria-label={l.quantidade === 1 ? 'Remover item' : 'Diminuir'}
                      className="size-10 text-xl flex items-center justify-center"
                    >
                      {l.quantidade === 1 ? <span aria-hidden className="text-base">🗑</span> : '−'}
                    </button>
                    <span className="w-6 text-center font-black tabular-nums">{l.quantidade}</span>
                    <button onClick={() => aumentar(l.linhaId)} aria-label="Aumentar" className="size-10 text-xl flex items-center justify-center">
                      +
                    </button>
                  </div>
                  <span className="font-black tabular-nums">{formatarBRL(subtotalDaLinha(l))}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Link href="/cardapio" className="block text-center font-bold text-brand-red py-2">
          + Adicionar mais itens
        </Link>

        <div className="bg-card rounded-2xl border border-border p-4">
          <label htmlFor="obs" className="font-bold block mb-1.5">
            Observações para a cozinha
          </label>
          <textarea
            id="obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ex.: trazer tudo junto, sem gelo…"
            className="w-full rounded-xl bg-background border-2 border-border p-3 outline-none focus:border-brand-red resize-none"
          />
        </div>

        <div className="rounded-2xl bg-surface-soft p-4 text-sm">
          <p className="font-bold">
            Mesa {sessao.mesa} · {sessao.cliente}
          </p>
          <p className="text-muted-foreground mt-1">
            O pagamento é feito no final, com a comanda entregue pelo garçom — no autoatendimento ou no caixa.
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-[480px] bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-between items-baseline px-1 mb-2">
          <span className="text-muted-foreground">Total</span>
          <span className="font-display text-3xl tabular-nums">{formatarBRL(totalDoCarrinho(linhas))}</span>
        </div>
        <button
          onClick={() => setConfirmando(true)}
          className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider active:scale-[0.98] transition-transform"
        >
          Enviar para a cozinha
        </button>
      </div>

      {confirmando && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar" className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center">
          <div className="w-full max-w-[480px] bg-card rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 animate-subir">
            <h2 id="titulo-confirmar" className="font-display text-3xl">
              Enviar pedido?
            </h2>
            <p className="text-muted-foreground">
              Depois de enviado, o pedido vai direto para a preparação e{' '}
              <strong className="text-foreground">não pode mais ser alterado</strong>. Você poderá pedir mais itens depois.
            </p>
            {erro && (
              <p role="alert" className="text-destructive text-sm font-bold">
                {erro}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={enviando}
                onClick={() => {
                  setConfirmando(false);
                  setErro(null);
                }}
                className="h-14 rounded-xl bg-secondary text-secondary-foreground font-black disabled:opacity-40"
              >
                Revisar
              </button>
              <button disabled={enviando} onClick={() => void enviar()} className="h-14 rounded-xl bg-brand-red text-primary-foreground font-black disabled:opacity-70">
                {enviando ? 'Enviando…' : 'Confirmar envio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
