'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Carregando } from '@/components/cabecalho';
import { EntrarDaEquipe } from '@/components/entrar-da-equipe';
import { useBipe } from '@/hooks/use-bipe';
import { useMontado } from '@/hooks/use-montado';
import { api, ErroDaApi, type PedidoNaCozinha, type StatusNaCozinha } from '@/lib/api';
import { ANTERIOR, idsNovos, minutosDesde, nivelDeEspera, PROXIMA, separarPorEtapa } from '@/lib/cozinha';
import { formatarHora } from '@/lib/formatar';
import { useSessaoDaEquipe } from '@/lib/sessao-da-equipe';

const INTERVALO_MS = 3000;

/**
 * Tela da cozinha (fase 3). Fica num computador ou tela touch na cozinha e pode ser espelhada
 * numa TV. Os pedidos do cardápio chegam sozinhos; o cozinheiro marca "Iniciar preparo" (o cliente
 * vê no celular que começou) e "Pronto" (o cliente vê, e na fase 4 o garçom é avisado).
 */
export default function Cozinha() {
  const montado = useMontado();
  const token = useSessaoDaEquipe((s) => s.token);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!montado) return <Carregando />;
  if (!token) return <EntrarDaEquipe papel="cozinha" aviso={aviso} />;
  return <PainelDaCozinha token={token} aoEncerrar={setAviso} />;
}

function PainelDaCozinha({ token, aoEncerrar }: { token: string; aoEncerrar: (aviso: string) => void }) {
  const { nome, restaurante, sair } = useSessaoDaEquipe();
  const [pedidos, setPedidos] = useState<PedidoNaCozinha[] | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [destaque, setDestaque] = useState<ReadonlySet<string>>(new Set());
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [mudando, setMudando] = useState<string | null>(null);
  const vistos = useRef<Set<string> | null>(null);
  const som = useBipe();
  const tocar = som.tocar;

  const encerrar = useCallback(
    (texto: string) => {
      sair();
      aoEncerrar(texto);
    },
    [sair, aoEncerrar],
  );

  /** Recarrega a lista fora do ciclo (depois de mudar um pedido). Preenchido pelo efeito abaixo. */
  const recarregar = useRef<() => void>(() => undefined);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const r = await api.pedidosDaCozinha(token);
        if (!ativo) return;
        const novos = idsNovos(vistos.current, r.pedidos);
        vistos.current = new Set(r.pedidos.map((p) => p.id));
        setPedidos(r.pedidos);
        setSemConexao(false);
        if (novos.length) {
          tocar();
          setDestaque((d) => new Set([...d, ...novos]));
          setTimeout(() => setDestaque((d) => new Set([...d].filter((id) => !novos.includes(id)))), 8000);
        }
      } catch (e) {
        if (!ativo) return;
        if (e instanceof ErroDaApi && (e.status === 401 || e.status === 403)) encerrar(e.message);
        else setSemConexao(true);
      }
    };
    recarregar.current = () => void atualizar();
    void atualizar();
    const id = setInterval(() => void atualizar(), INTERVALO_MS);
    const relogio = setInterval(() => setAgora(Date.now()), 15_000);
    return () => {
      ativo = false;
      clearInterval(id);
      clearInterval(relogio);
    };
  }, [token, tocar, encerrar]);

  const mudar = async (p: PedidoNaCozinha, para: StatusNaCozinha) => {
    setMudando(p.id);
    // Otimista: o card muda de coluna na hora; se a API recusar, a lista volta do servidor.
    setPedidos((lista) =>
      lista?.map((x) =>
        x.id === p.id ? { ...x, status: para, prontoEm: para === 'pronto' ? new Date().toISOString() : x.prontoEm } : x,
      ) ?? null,
    );
    try {
      await api.mudarStatus(token, p.id, p.status, para);
    } catch (e) {
      if (e instanceof ErroDaApi && e.status === 401) return encerrar(e.message);
      setMensagem(e instanceof ErroDaApi ? e.message : 'Não foi possível atualizar o pedido.');
      setTimeout(() => setMensagem(null), 5000);
    } finally {
      setMudando(null);
      recarregar.current();
    }
  };

  if (!pedidos) return <Carregando />;
  const { novos, emPreparo, prontos } = separarPorEtapa(pedidos);
  const atrasados = [...novos, ...emPreparo].filter((p) => nivelDeEspera(minutosDesde(p.criadoEm, agora)) === 'atrasado').length;
  const card = (p: PedidoNaCozinha) => (
    <CardDoPedido key={p.id} pedido={p} agora={agora} novo={destaque.has(p.id)} ocupado={mudando === p.id} aoMudar={mudar} />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground text-background">
      <header className="flex items-center justify-between gap-4 flex-wrap px-6 py-4 border-b border-background/10">
        <div className="flex items-center gap-6 flex-wrap">
          <h1 className="font-display text-4xl tracking-wide leading-none">
            <span className="text-brand-red">Easy</span>Menu · Cozinha
          </h1>
          <div className="flex gap-2 text-sm">
            <Contador rotulo="Novos" valor={novos.length} />
            <Contador rotulo="Em preparo" valor={emPreparo.length} tom="amarelo" />
            {atrasados > 0 && <Contador rotulo="Atrasados" valor={atrasados} tom="vermelho" />}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {semConexao && (
            <span role="alert" className="rounded-full bg-brand-red px-3 py-1 text-sm font-bold animate-pulse">
              Sem conexão — tentando de novo
            </span>
          )}
          {!som.liberado && (
            <button onClick={som.liberar} className="h-10 px-4 rounded-xl text-sm font-bold uppercase bg-brand-yellow text-accent-foreground">
              🔔 Ativar som
            </button>
          )}
          <span className="font-display text-3xl tabular-nums opacity-80">
            {new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
            className="h-10 px-4 rounded-xl text-sm font-bold uppercase bg-background/10 hover:bg-background/20"
          >
            Tela cheia
          </button>
          <span className="text-sm opacity-70">
            {nome} · {restaurante}
          </span>
          <button onClick={sair} className="h-10 px-4 rounded-xl text-sm font-bold uppercase bg-background/10 hover:bg-background/20">
            Sair
          </button>
        </div>
      </header>

      {mensagem && (
        <p role="alert" className="mx-6 mt-3 rounded-xl bg-brand-yellow text-accent-foreground px-4 py-2 font-bold">
          {mensagem}
        </p>
      )}

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr_minmax(0,0.6fr)]">
        <Coluna titulo="Novos pedidos" total={novos.length} cor="bg-background/40">
          {novos.length ? novos.map(card) : <Vazio texto="Nenhum pedido novo. Os pedidos do cardápio aparecem aqui sozinhos." />}
        </Coluna>
        <Coluna titulo="Em preparo" total={emPreparo.length} cor="bg-brand-yellow" className="lg:border-l border-background/10">
          {emPreparo.length ? emPreparo.map(card) : <Vazio texto="Nada em preparo." />}
        </Coluna>
        <Coluna titulo="Prontos" total={prontos.length} cor="bg-success" className="lg:border-l border-background/10" estreita>
          {prontos.length ? prontos.map(card) : <Vazio texto="Os prontos ficam aqui por 30 minutos." />}
        </Coluna>
      </main>
    </div>
  );
}

function CardDoPedido({
  pedido: p,
  agora,
  novo,
  ocupado,
  aoMudar,
}: {
  pedido: PedidoNaCozinha;
  agora: number;
  novo: boolean;
  ocupado: boolean;
  aoMudar: (p: PedidoNaCozinha, para: StatusNaCozinha) => void;
}) {
  const pronto = p.status === 'pronto';
  const minutos = minutosDesde(p.criadoEm, agora);
  const nivel = pronto ? 'ok' : nivelDeEspera(minutos);
  const proxima = PROXIMA[p.status];
  const anterior = ANTERIOR[p.status];
  const totalDeItens = p.itens.filter((i) => !i.cancelado).reduce((s, i) => s + i.quantidade, 0);

  return (
    <article
      className={`rounded-3xl bg-background/5 border-2 flex flex-col overflow-hidden transition-colors ${
        nivel === 'atrasado' ? 'border-brand-red' : nivel === 'atencao' ? 'border-brand-yellow/70' : 'border-background/15'
      } ${novo ? 'animate-cart-bump ring-4 ring-brand-yellow/60' : ''} ${pronto ? 'opacity-70' : ''}`}
    >
      <div className={`flex items-center justify-between px-5 py-3 ${nivel === 'atrasado' ? 'bg-brand-red' : 'bg-background/10'}`}>
        <div>
          <div className={`font-display leading-none ${pronto ? 'text-3xl' : 'text-4xl'}`}>Mesa {p.mesa}</div>
          <div className="text-sm opacity-80 mt-1">
            {p.cliente} · #{p.numero}
          </div>
        </div>
        <div className="text-right">
          {pronto ? (
            <div className="text-sm font-bold">Pronto às {formatarHora(p.prontoEm ?? p.criadoEm)}</div>
          ) : (
            <div className="font-display text-3xl leading-none tabular-nums">{minutos} min</div>
          )}
          <div className="text-xs opacity-80 mt-1">{novo ? 'NOVO' : `Pedido às ${formatarHora(p.criadoEm)}`}</div>
        </div>
      </div>

      {!pronto && (
        <ul className="px-5 py-3 space-y-2 flex-1">
          {p.itens.map((it, i) => (
            <li key={i} className={`flex gap-3 border-b border-background/10 pb-2 last:border-0 ${it.cancelado ? 'opacity-50' : ''}`}>
              <span className="font-display text-2xl leading-none text-brand-yellow tabular-nums min-w-8">{it.quantidade}x</span>
              <div className="flex-1">
                <div className={`text-lg font-bold leading-tight ${it.cancelado ? 'line-through' : ''}`}>{it.nome}</div>
                {it.cancelado && <div className="text-xs font-bold uppercase">Cancelado — não preparar</div>}
                {it.observacao && !it.cancelado && (
                  <div className="text-sm font-bold text-brand-red bg-brand-red/15 inline-block rounded px-1.5 mt-0.5">
                    {it.observacao.toUpperCase()}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {p.observacao && !pronto && (
        <p className="mx-5 mb-3 text-sm font-semibold bg-brand-yellow text-accent-foreground rounded-xl px-3 py-2">⚠ {p.observacao}</p>
      )}

      <div className="px-5 pb-5 pt-1 flex items-center gap-3">
        {!pronto && (
          <span className="text-xs opacity-60">
            {totalDeItens} {totalDeItens === 1 ? 'item' : 'itens'}
          </span>
        )}
        {anterior && (
          <button
            onClick={() => aoMudar(p, anterior)}
            disabled={ocupado}
            className="h-14 px-4 rounded-2xl text-sm font-bold uppercase bg-background/10 hover:bg-background/20 disabled:opacity-40"
          >
            Desfazer
          </button>
        )}
        {proxima && (
          <button
            onClick={() => aoMudar(p, proxima)}
            disabled={ocupado}
            className={`flex-1 h-14 rounded-2xl font-display text-xl uppercase tracking-wide active:scale-95 transition-transform disabled:opacity-40 ${
              proxima === 'em_preparo' ? 'bg-brand-yellow text-accent-foreground' : 'bg-success text-success-foreground'
            }`}
          >
            {proxima === 'em_preparo' ? 'Iniciar preparo' : '✓ Pronto'}
          </button>
        )}
      </div>
    </article>
  );
}

function Contador({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: 'amarelo' | 'vermelho' }) {
  const cor =
    tom === 'amarelo'
      ? 'bg-brand-yellow/15 text-brand-yellow'
      : tom === 'vermelho'
        ? 'bg-brand-red text-primary-foreground animate-pulse'
        : 'bg-background/10';
  return (
    <span className={`rounded-full px-3 py-1 font-bold ${cor}`}>
      <span className="tabular-nums">{valor}</span> {rotulo}
    </span>
  );
}

function Coluna({
  titulo,
  total,
  cor,
  className = '',
  estreita = false,
  children,
}: {
  titulo: string;
  total: number;
  cor: string;
  className?: string;
  estreita?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center gap-3 px-6 py-3">
        <span className={`h-5 w-1.5 rounded-full ${cor}`} aria-hidden />
        <h2 className="font-display text-2xl tracking-wide">{titulo}</h2>
        <span className="text-sm opacity-60 tabular-nums">{total}</span>
      </div>
      <div
        className={`no-scrollbar flex-1 overflow-y-auto px-6 pt-3 pb-6 grid auto-rows-min content-start gap-4 ${estreita ? '' : 'xl:grid-cols-2'}`}
      >
        {children}
      </div>
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="xl:col-span-2 rounded-3xl border-2 border-dashed border-background/15 py-16 px-4 text-center opacity-60">{texto}</div>
  );
}
