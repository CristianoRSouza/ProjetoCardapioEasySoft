'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import { Carregando, Logo } from '@/components/cabecalho';
import { EntrarDaEquipe } from '@/components/entrar-da-equipe';
import { useMontado } from '@/hooks/use-montado';
import { ErroDaApi } from '@/lib/api';
import { desativarPush } from '@/lib/push';
import { useSessaoDaEquipe } from '@/lib/sessao-da-equipe';

export interface Garcom {
  token: string;
  /** Erro de sessão (401/403) devolve ao login com o aviso; outros erros voltam como texto. */
  tratarErro: (e: unknown) => string | null;
}

/** Só renderiza as telas do garçom com uma sessão de garçom; senão, o login. */
export function AreaDoGarcom({ children }: { children: (garcom: Garcom) => ReactNode }) {
  const montado = useMontado();
  const { token, papel, sair } = useSessaoDaEquipe();
  const [aviso, setAviso] = useState<string | null>(null);

  const tratarErro = useCallback(
    (e: unknown) => {
      if (e instanceof ErroDaApi && (e.status === 401 || e.status === 403)) {
        sair();
        setAviso(e.message);
        return null;
      }
      return e instanceof ErroDaApi ? e.message : 'Não foi possível concluir. Tente de novo.';
    },
    [sair],
  );

  if (!montado) return <Carregando />;
  if (!token || papel !== 'garcom') {
    return <EntrarDaEquipe papel="garcom" aviso={aviso ?? (token ? 'Este aparelho estava com outro usuário. Entre como garçom.' : null)} />;
  }
  return children({ token, tratarErro });
}

/** Cabeçalho das telas do garçom: voltar (ou logo), título e, na tela inicial, "Sair". */
export function CabecalhoDoGarcom({ titulo, voltarPara, direita }: { titulo: ReactNode; voltarPara?: string; direita?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-foreground text-background px-3 h-14 flex items-center gap-2 shrink-0 pt-[env(safe-area-inset-top)] box-content">
      {voltarPara ? (
        <Link href={voltarPara} aria-label="Voltar" className="size-11 -ml-1 rounded-full flex items-center justify-center text-2xl active:bg-background/10">
          <span aria-hidden>‹</span>
        </Link>
      ) : (
        <Logo />
      )}
      <div className="flex-1 min-w-0 font-display text-2xl leading-none tracking-wide truncate">{titulo}</div>
      {direita}
    </header>
  );
}

/** Sair: o celular para de receber os avisos deste garçom. */
export function BotaoSair({ token }: { token: string }) {
  const sair = useSessaoDaEquipe((s) => s.sair);
  const [saindo, setSaindo] = useState(false);
  return (
    <button
      onClick={() => {
        setSaindo(true);
        void desativarPush(token)
          .catch(() => undefined)
          .finally(sair);
      }}
      disabled={saindo}
      className="h-9 px-3 rounded-lg text-xs font-bold uppercase bg-background/10 active:bg-background/20 disabled:opacity-50"
    >
      Sair
    </button>
  );
}
