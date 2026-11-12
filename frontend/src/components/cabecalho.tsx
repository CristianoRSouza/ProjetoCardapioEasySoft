'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSessaoDaMesa } from '@/lib/sessao-da-mesa';

export function Logo({ tamanho = 'md' }: { tamanho?: 'md' | 'lg' }) {
  return (
    <div
      className={`${tamanho === 'lg' ? 'size-10 text-xl rounded-xl' : 'size-9 text-lg rounded-lg'} bg-brand-red text-primary-foreground flex items-center justify-center font-display`}
    >
      E!
    </div>
  );
}

export function Cabecalho({ titulo, voltarPara, direita }: { titulo?: string; voltarPara?: string; direita?: ReactNode }) {
  const mesa = useSessaoDaMesa((s) => s.mesa);
  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-3 h-14 flex items-center gap-2 shrink-0">
      {voltarPara ? (
        <Link
          href={voltarPara}
          aria-label="Voltar"
          className="size-11 -ml-1 rounded-full flex items-center justify-center text-2xl text-foreground active:bg-secondary"
        >
          <span aria-hidden>‹</span>
        </Link>
      ) : (
        <Logo />
      )}
      <p className="flex-1 min-w-0 font-display text-xl leading-none tracking-wide truncate text-foreground">
        {titulo ?? (
          <>
            <span className="text-brand-red">Easy</span>Menu
          </>
        )}
      </p>
      {mesa && (
        <span className="h-8 px-3 rounded-full bg-brand-yellow text-accent-foreground text-xs font-black uppercase tracking-wider flex items-center">
          Mesa {mesa}
        </span>
      )}
      {direita}
    </header>
  );
}

export function TelaCheia({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh flex flex-col items-center justify-center text-center p-8 gap-4">{children}</main>;
}

export function Carregando() {
  return (
    <TelaCheia>
      <div className="size-10 rounded-full border-4 border-border border-t-brand-red animate-spin" aria-hidden />
      <p className="text-muted-foreground">Carregando…</p>
    </TelaCheia>
  );
}
