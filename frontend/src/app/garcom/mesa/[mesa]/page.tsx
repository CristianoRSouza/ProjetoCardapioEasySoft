'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Carregando } from '@/components/cabecalho';
import { api, type ItemNaMesa, type PedidoNaMesa, type StatusNaCozinha } from '@/lib/api';
import { formatarBRL, formatarHora } from '@/lib/formatar';
import { MOTIVO_DO_BLOQUEIO } from '@/lib/garcom';
import { AreaDoGarcom, CabecalhoDoGarcom, type Garcom } from '../../area';

const INTERVALO_MS = 5000;

const ROTULO: Record<StatusNaCozinha, string> = {
  recebido: 'Aguardando a cozinha',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
};
const COR: Record<StatusNaCozinha, string> = {
  recebido: 'bg-secondary text-secondary-foreground',
  em_preparo: 'bg-brand-yellow text-accent-foreground',
  pronto: 'bg-success text-success-foreground',
  entregue: 'bg-foreground/10 text-foreground',
};

/** Pedidos da comanda aberta da mesa. Corrige item enquanto a cozinha não começou. */
export default function MesaDoGarcom() {
  return <AreaDoGarcom>{(g) => <Mesa {...g} />}</AreaDoGarcom>;
}

function Mesa({ token, tratarErro }: Garcom) {
  const { mesa: bruta } = useParams<{ mesa: string }>();
  const mesaPedida = decodeURIComponent(bruta);
  const [dados, setDados] = useState<{ mesa: string; total: number; pedidos: PedidoNaMesa[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const recarregar = useRef<() => void>(() => undefined);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const r = await api.mesaDoGarcom(token, mesaPedida);
        if (ativo) setDados(r);
      } catch (e) {
        if (ativo) setErro(tratarErro(e));
      }
    };
    recarregar.current = () => void atualizar();
    void atualizar();
    const id = setInterval(() => document.visibilityState === 'visible' && void atualizar(), INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, mesaPedida, tratarErro]);

  const executar = async (chave: string, acao: () => Promise<unknown>) => {
    setOcupado(chave);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(tratarErro(e));
    } finally {
      setOcupado(null);
      recarregar.current();
    }
  };

  const corrigir = (p: PedidoNaMesa, i: ItemNaMesa, quantidade: number) => {
    if (quantidade === 0 && !confirm(`Cancelar ${i.quantidade}x ${i.nome}?`)) return;
    void executar(i.orderItemId, () => api.corrigirItem(token, p.id, i.orderItemId, quantidade));
  };

  if (!dados) return erro ? <p className="p-6 text-destructive font-bold">{erro}</p> : <Carregando />;
  const mesa = dados.mesa;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <CabecalhoDoGarcom
        titulo={`Mesa ${mesa}`}
        voltarPara="/garcom"
        direita={<span className="font-display text-2xl tabular-nums">{formatarBRL(dados.total)}</span>}
      />

      {erro && (
        <p role="alert" className="mx-3 mt-3 rounded-xl bg-brand-yellow text-accent-foreground px-3 py-2 text-sm font-bold">
          {erro}
        </p>
      )}

      <main className="flex-1 p-3 space-y-3 pb-28">
        {dados.pedidos.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="font-display text-3xl">Mesa sem pedidos</p>
            <p className="text-muted-foreground">Nenhuma comanda aberta pelo cardápio nesta mesa. Lance o primeiro pedido abaixo.</p>
          </div>
        ) : (
          [...dados.pedidos].reverse().map((p) => (
            <article key={p.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl leading-none">Pedido #{p.numero}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.cliente} · {formatarHora(p.criadoEm)}
                  </p>
                </div>
                <span className={`px-3 h-7 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center ${COR[p.status]}`}>
                  {ROTULO[p.status]}
                </span>
              </div>

              <ul className="divide-y divide-border">
                {p.itens.map((i) => (
                  <li key={i.orderItemId} className={`py-2 ${i.cancelado ? 'text-muted-foreground' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold leading-tight ${i.cancelado ? 'line-through' : ''}`}>
                          {i.bloqueio === null ? '' : `${i.quantidade}x `}
                          {i.nome}
                        </p>
                        {i.observacao && !i.cancelado && <p className="text-xs text-brand-red font-bold">{i.observacao}</p>}
                        {i.bloqueio && <p className="text-[11px] text-muted-foreground mt-0.5">{MOTIVO_DO_BLOQUEIO[i.bloqueio]}</p>}
                      </div>
                      {i.bloqueio === null ? (
                        <Ajuste item={i} ocupado={ocupado === i.orderItemId} aoMudar={(q) => corrigir(p, i, q)} />
                      ) : (
                        <span className={`tabular-nums text-sm shrink-0 ${i.cancelado ? 'line-through' : ''}`}>
                          {formatarBRL(i.precoUnitario * i.quantidade)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {p.observacao && <p className="text-xs bg-surface-soft rounded-lg p-2">Obs.: {p.observacao}</p>}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total do pedido</span>
                <span className="font-black tabular-nums">{formatarBRL(p.total)}</span>
              </div>

              {p.status === 'pronto' && (
                <button
                  onClick={() => void executar(p.id, () => api.marcarEntregue(token, p.id))}
                  disabled={ocupado === p.id}
                  className="w-full h-12 rounded-xl bg-success text-success-foreground font-black uppercase tracking-wider disabled:opacity-50"
                >
                  ✓ Entregue na mesa
                </button>
              )}
            </article>
          ))
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-[480px] bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href={`/garcom/mesa/${encodeURIComponent(mesa)}/pedir`}
          className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider flex items-center justify-center"
        >
          + Lançar pedido na mesa {mesa}
        </Link>
      </div>
    </div>
  );
}

/** − quantidade + e cancelar. Cada toque grava na hora (a cozinha vê a correção no card). */
function Ajuste({ item, ocupado, aoMudar }: { item: ItemNaMesa; ocupado: boolean; aoMudar: (quantidade: number) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={() => aoMudar(0)}
        disabled={ocupado}
        aria-label={`Cancelar ${item.nome}`}
        className="h-9 px-2 rounded-lg text-xs font-bold uppercase text-destructive active:bg-secondary disabled:opacity-40"
      >
        Cancelar
      </button>
      <button
        onClick={() => aoMudar(item.quantidade - 1)}
        disabled={ocupado || item.quantidade <= 1}
        aria-label="Diminuir"
        className="size-9 rounded-full bg-secondary text-xl font-black disabled:opacity-30"
      >
        −
      </button>
      <span className="w-7 text-center font-black tabular-nums" aria-label="Quantidade">
        {item.quantidade}
      </span>
      <button
        onClick={() => aoMudar(item.quantidade + 1)}
        disabled={ocupado || item.quantidade >= 99}
        aria-label="Aumentar"
        className="size-9 rounded-full bg-brand-red text-primary-foreground text-xl font-black disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
