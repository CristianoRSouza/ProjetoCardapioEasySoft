'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cabecalho, Carregando } from '@/components/cabecalho';
import { useExigirMesa } from '@/hooks/use-exigir-mesa';
import { api, ErroDaApi, type PedidoDaMesa, type StatusNaCozinha } from '@/lib/api';
import { avancos } from '@/lib/cozinha';
import { formatarBRL, formatarHora } from '@/lib/formatar';

const ETAPAS: StatusNaCozinha[] = ['recebido', 'em_preparo', 'pronto', 'entregue'];
const ROTULO: Record<StatusNaCozinha, string> = { recebido: 'Recebido', em_preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue' };
const INTERVALO_MS = 4000;

/** Pedidos da comanda aberta da mesa, atualizando sozinho. Fechada a conta, a lista some. */
export default function MinhaMesa() {
  const sessao = useExigirMesa();
  const token = sessao?.token;
  const [dados, setDados] = useState<{ total: number; pedidos: PedidoDaMesa[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ chave: string; texto: string; pronto: boolean }[]>([]);
  const statusAnterior = useRef<Map<string, StatusNaCozinha> | null>(null);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    const atualizar = async () => {
      try {
        const r = await api.pedidosDaMesa(token);
        if (ativo) {
          // A cozinha mexeu num pedido desde a última leitura: aviso na tela e o celular vibra.
          const mudou = avancos(statusAnterior.current, r.pedidos);
          statusAnterior.current = new Map(r.pedidos.map((p) => [p.id, p.status]));
          if (mudou.length) {
            const novos = mudou.map((m) => ({
              chave: `${m.numero}-${m.status}`,
              pronto: m.status === 'pronto',
              texto:
                m.status === 'pronto'
                  ? `Pedido #${m.numero} está pronto! Já vai chegar na mesa.`
                  : `A cozinha começou a preparar o pedido #${m.numero}.`,
            }));
            setAvisos((a) => [...a, ...novos]);
            navigator.vibrate?.(mudou.some((m) => m.status === 'pronto') ? [200, 100, 200] : 150);
            setTimeout(() => setAvisos((a) => a.filter((x) => !novos.some((n) => n.chave === x.chave))), 8000);
          }
          setDados(r);
          setErro(null);
        }
      } catch (e) {
        if (ativo) setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível atualizar.');
      }
    };
    void atualizar();
    const id = setInterval(() => document.visibilityState === 'visible' && void atualizar(), INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token]);

  if (!sessao) return <Carregando />;

  return (
    <div className="min-h-dvh flex flex-col">
      <Cabecalho titulo="Pedidos da mesa" voltarPara="/cardapio" />
      {avisos.length > 0 && (
        <div className="sticky top-14 z-20 px-3 pt-3 space-y-2" aria-live="polite">
          {avisos.map((a) => (
            <p
              key={a.chave}
              className={`animate-cart-bump rounded-2xl px-4 py-3 font-bold shadow-lg ${
                a.pronto ? 'bg-success text-success-foreground' : 'bg-brand-yellow text-accent-foreground'
              }`}
            >
              {a.pronto ? '✓ ' : '🍳 '}
              {a.texto}
            </p>
          ))}
        </div>
      )}
      <main className="flex-1 p-3 space-y-3 pb-32">
        {erro && (
          <p role="alert" className="text-sm text-destructive font-bold px-1">
            {erro}
          </p>
        )}
        {!dados ? null : dados.pedidos.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="font-display text-3xl">Nenhum pedido ainda</p>
            <p className="text-muted-foreground">Os pedidos enviados por esta mesa aparecem aqui.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground px-1">Pedidos já enviados não podem ser alterados. Precisa de algo? Chame o garçom.</p>
            {[...dados.pedidos].reverse().map((p) => {
              const etapa = ETAPAS.indexOf(p.status);
              return (
                <article key={p.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-2xl leading-none">Pedido #{p.numero}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.cliente} · {formatarHora(p.criadoEm)}
                      </p>
                    </div>
                    <span
                      className={`px-3 h-7 rounded-full text-xs font-black uppercase tracking-wider flex items-center ${
                        p.status === 'pronto' || p.status === 'entregue'
                          ? 'bg-success text-success-foreground'
                          : p.status === 'em_preparo'
                            ? 'bg-brand-yellow text-accent-foreground'
                            : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {ROTULO[p.status]}
                    </span>
                  </div>
                  <div className="flex gap-1" aria-hidden>
                    {ETAPAS.map((s, i) => (
                      <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= etapa ? 'bg-success' : 'bg-border'}`} />
                    ))}
                  </div>
                  <ul className="text-sm space-y-1">
                    {p.itens.map((it, i) => (
                      <li key={i} className={`flex justify-between gap-2 ${it.cancelado ? 'text-muted-foreground' : ''}`}>
                        <span>
                          <span className={it.cancelado ? 'line-through' : ''}>
                            <strong>{it.quantidade}x</strong> {it.nome}
                          </span>
                          {it.cancelado ? (
                            <span className="text-xs font-bold uppercase"> · cancelado</span>
                          ) : (
                            it.observacao && <span className="text-muted-foreground"> · {it.observacao}</span>
                          )}
                        </span>
                        <span className={`tabular-nums shrink-0 ${it.cancelado ? 'line-through' : ''}`}>
                          {formatarBRL(it.precoUnitario * it.quantidade)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {p.observacao && <p className="text-xs bg-surface-soft rounded-lg p-2">Obs.: {p.observacao}</p>}
                </article>
              );
            })}
            <div className="rounded-2xl bg-surface-soft p-4 flex justify-between items-baseline">
              <span className="font-bold">Consumo da mesa</span>
              <span className="font-display text-3xl tabular-nums">{formatarBRL(dados.total)}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center px-4">
              O pagamento é feito com a comanda que o garçom vai entregar, no autoatendimento ou no caixa.
            </p>
          </>
        )}
      </main>
      <div className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-[480px] bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href="/cardapio"
          className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider flex items-center justify-center"
        >
          Pedir mais
        </Link>
      </div>
    </div>
  );
}
