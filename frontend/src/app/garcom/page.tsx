'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Carregando } from '@/components/cabecalho';
import { useBipe } from '@/hooks/use-bipe';
import { api, type ProntoParaLevar, type ResumoDaMesa } from '@/lib/api';
import { minutosDesde } from '@/lib/cozinha';
import { formatarBRL } from '@/lib/formatar';
import { ordenarMesas, prontosNovos } from '@/lib/garcom';
import { ativarPush, estadoDoPush, type EstadoDoPush } from '@/lib/push';
import { useSessaoDaEquipe } from '@/lib/sessao-da-equipe';
import { AreaDoGarcom, BotaoSair, CabecalhoDoGarcom, type Garcom } from './area';

const INTERVALO_MS = 4000;

/**
 * App do garçom (fase 4). Tela inicial: o que a cozinha deixou pronto para levar (com bipe,
 * vibração e push) e as mesas com comanda aberta do cardápio.
 */
export default function TelaDoGarcom() {
  return <AreaDoGarcom>{(g) => <Painel {...g} />}</AreaDoGarcom>;
}

function Painel({ token, tratarErro }: Garcom) {
  const router = useRouter();
  const { nome, restaurante } = useSessaoDaEquipe();
  const [dados, setDados] = useState<{ prontos: ProntoParaLevar[]; mesas: ResumoDaMesa[] } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<ReadonlySet<string>>(new Set());
  const [entregando, setEntregando] = useState<string | null>(null);
  const [novaMesa, setNovaMesa] = useState('');
  const vistos = useRef<Set<string> | null>(null);
  const recarregar = useRef<() => void>(() => undefined);
  const { tocar } = useBipe();

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const r = await api.painelDoGarcom(token);
        if (!ativo) return;
        const novos = prontosNovos(vistos.current, r.prontos);
        vistos.current = new Set(r.prontos.map((p) => p.id));
        setDados(r);
        setAgora(Date.parse(r.agora) || Date.now());
        setErro(null);
        if (novos.length) {
          tocar();
          navigator.vibrate?.([200, 100, 200, 100, 200]);
          setDestaque((d) => new Set([...d, ...novos]));
          setTimeout(() => setDestaque((d) => new Set([...d].filter((id) => !novos.includes(id)))), 10_000);
        }
      } catch (e) {
        if (ativo) setErro(tratarErro(e));
      }
    };
    recarregar.current = () => void atualizar();
    void atualizar();
    const id = setInterval(() => document.visibilityState === 'visible' && void atualizar(), INTERVALO_MS);
    // Voltando ao app (tocou no aviso, desbloqueou o celular): atualiza na hora.
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      ativo = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [token, tocar, tratarErro]);

  const entregar = async (p: ProntoParaLevar) => {
    setEntregando(p.id);
    setDados((d) => d && { ...d, prontos: d.prontos.filter((x) => x.id !== p.id) });
    try {
      await api.marcarEntregue(token, p.id);
    } catch (e) {
      setErro(tratarErro(e));
    } finally {
      setEntregando(null);
      recarregar.current();
    }
  };

  const abrirMesa = (e: React.FormEvent) => {
    e.preventDefault();
    const mesa = novaMesa.trim();
    if (mesa) router.push(`/garcom/mesa/${encodeURIComponent(mesa)}`);
  };

  if (!dados) {
    return erro ? <p className="p-6 text-destructive font-bold">{erro}</p> : <Carregando />;
  }
  const mesas = ordenarMesas(dados.mesas);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <CabecalhoDoGarcom
        titulo={
          <>
            <span className="text-brand-red">Easy</span>Menu · Garçom
          </>
        }
        direita={<BotaoSair token={token} />}
      />
      <p className="px-4 pt-2 text-xs text-muted-foreground">
        {nome} · {restaurante}
      </p>

      <AvisosNoCelular token={token} />

      {erro && (
        <p role="alert" className="mx-3 mt-2 rounded-xl bg-brand-yellow text-accent-foreground px-3 py-2 text-sm font-bold">
          {erro}
        </p>
      )}

      <main className="flex-1 p-3 space-y-6 pb-10">
        <section aria-labelledby="titulo-prontos">
          <h2 id="titulo-prontos" className="font-display text-3xl tracking-wide px-1 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full bg-success" aria-hidden />
            Prontos para levar
            <span className="text-base text-muted-foreground tabular-nums">{dados.prontos.length}</span>
          </h2>
          {dados.prontos.length === 0 ? (
            <p className="mt-2 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
              Nada pronto agora. Quando a cozinha marcar &quot;Pronto&quot;, o pedido aparece aqui e o celular avisa.
            </p>
          ) : (
            <ul className="mt-2 space-y-3" aria-live="polite">
              {dados.prontos.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-2xl bg-success text-success-foreground p-4 shadow-lg ${destaque.has(p.id) ? 'animate-cart-bump ring-4 ring-brand-yellow' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-4xl leading-none">Mesa {p.mesa}</p>
                      <p className="text-sm opacity-90 mt-1">
                        #{p.numero} · {p.cliente}
                      </p>
                    </div>
                    <span className="text-sm font-bold opacity-90 tabular-nums">há {minutosDesde(p.prontoEm, agora)} min</span>
                  </div>
                  <ul className="mt-2 text-sm space-y-0.5">
                    {p.itens
                      .filter((i) => !i.cancelado)
                      .map((i, n) => (
                        <li key={n}>
                          <strong>{i.quantidade}x</strong> {i.nome}
                          {i.observacao && <span className="opacity-90"> · {i.observacao}</span>}
                        </li>
                      ))}
                  </ul>
                  <button
                    onClick={() => void entregar(p)}
                    disabled={entregando === p.id}
                    className="mt-3 w-full h-14 rounded-xl bg-success-foreground text-success font-black uppercase tracking-wider active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    ✓ Entregue na mesa
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-mesas">
          <h2 id="titulo-mesas" className="font-display text-3xl tracking-wide px-1 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full bg-brand-red" aria-hidden />
            Mesas abertas
            <span className="text-base text-muted-foreground tabular-nums">{mesas.length}</span>
          </h2>
          <form onSubmit={abrirMesa} className="mt-2 flex gap-2">
            <input
              value={novaMesa}
              onChange={(e) => setNovaMesa(e.target.value)}
              inputMode="numeric"
              maxLength={10}
              placeholder="Nº da mesa"
              aria-label="Número da mesa"
              className="flex-1 min-w-0 h-12 px-4 rounded-xl border-2 border-border bg-card text-base"
            />
            <button
              type="submit"
              disabled={!novaMesa.trim()}
              className="h-12 px-5 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider disabled:opacity-40"
            >
              Abrir
            </button>
          </form>
          {mesas.length === 0 ? (
            <p className="mt-3 text-center text-muted-foreground text-sm">Nenhuma mesa com pedido pelo cardápio agora.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {mesas.map((m) => (
                <li key={m.mesa}>
                  <Link
                    href={`/garcom/mesa/${encodeURIComponent(m.mesa)}`}
                    className="block rounded-2xl bg-card border border-border p-3 active:scale-[0.98] transition-transform"
                  >
                    <p className="font-display text-3xl leading-none">Mesa {m.mesa}</p>
                    <p className="font-black tabular-nums mt-1">{formatarBRL(m.total)}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-bold uppercase">
                      {m.prontos > 0 && <span className="rounded-full bg-success text-success-foreground px-2 py-0.5">{m.prontos} pronto</span>}
                      {m.naCozinha > 0 && (
                        <span className="rounded-full bg-brand-yellow text-accent-foreground px-2 py-0.5">{m.naCozinha} na cozinha</span>
                      )}
                      {m.prontos === 0 && m.naCozinha === 0 && <span className="rounded-full bg-secondary px-2 py-0.5">servida</span>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {m.pedidos} {m.pedidos === 1 ? 'pedido' : 'pedidos'} · aberta há {formatarDuracao(minutosDesde(m.abertaEm, agora))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function formatarDuracao(min: number) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

const TEXTO_DO_PUSH: Partial<Record<EstadoDoPush, string>> = {
  inativo: 'Ative os avisos para o celular tocar quando um pedido ficar pronto, mesmo bloqueado.',
  negado: 'Os avisos estão bloqueados neste navegador. Libere as notificações deste site nas configurações.',
  instalar_primeiro: 'No iPhone: toque em Compartilhar → "Adicionar à Tela de Início", abra o app pelo ícone e ative os avisos.',
  sem_suporte: 'Este navegador não recebe avisos com o app fechado. Deixe o app aberto para ouvir o bipe.',
};

/** Faixa que convida a ligar o push. Some quando os avisos estão ligados (ou o restaurante não usa). */
function AvisosNoCelular({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoDoPush | null>(null);
  const [ativando, setAtivando] = useState(false);

  useEffect(() => {
    let ativo = true;
    estadoDoPush(token)
      .then((e) => ativo && setEstado(e))
      .catch(() => ativo && setEstado(null));
    return () => {
      ativo = false;
    };
  }, [token]);

  if (!estado || estado === 'desligado') return null;
  if (estado === 'ativo') {
    return <p className="mx-3 mt-2 text-xs font-bold text-success">🔔 Avisos ligados neste celular</p>;
  }
  return (
    <div className="mx-3 mt-2 rounded-2xl bg-brand-yellow text-accent-foreground p-3 space-y-2">
      <p className="text-sm font-semibold">{TEXTO_DO_PUSH[estado]}</p>
      {estado === 'inativo' && (
        <button
          onClick={() => {
            setAtivando(true);
            ativarPush(token)
              .then(setEstado)
              .catch(() => setEstado('sem_suporte'))
              .finally(() => setAtivando(false));
          }}
          disabled={ativando}
          className="w-full h-11 rounded-xl bg-foreground text-background font-black uppercase tracking-wider text-sm disabled:opacity-50"
        >
          🔔 Ativar avisos
        </button>
      )}
    </div>
  );
}
