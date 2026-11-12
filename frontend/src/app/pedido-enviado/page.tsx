'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useSessaoDaMesa } from '@/lib/sessao-da-mesa';
import { useMontado } from '@/hooks/use-montado';

function Conteudo() {
  const numero = Number(useSearchParams().get('n')) || 0;
  const mesa = useSessaoDaMesa((s) => s.mesa);
  const montado = useMontado();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-6 gap-5">
      <div className="size-24 rounded-full bg-success text-success-foreground text-5xl flex items-center justify-center animate-check-pop">✓</div>
      <h1 className="font-display text-5xl leading-none">Pedido enviado!</h1>
      {numero > 0 && (
        <p className="text-lg">
          Pedido <strong>#{numero}</strong>
          {montado && mesa && <> · Mesa {mesa}</>}
        </p>
      )}
      <p className="text-muted-foreground max-w-xs">A cozinha já recebeu. Você pode acompanhar o andamento por aqui.</p>
      <div className="w-full space-y-3 pt-2">
        <Link
          href="/minha-mesa"
          className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider flex items-center justify-center"
        >
          Acompanhar pedidos
        </Link>
        <Link href="/cardapio" className="w-full h-14 rounded-xl bg-secondary text-secondary-foreground font-black flex items-center justify-center">
          Pedir mais
        </Link>
      </div>
    </main>
  );
}

export default function PedidoEnviado() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
