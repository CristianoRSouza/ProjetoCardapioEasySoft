'use client';

import { useState } from 'react';

/** Foto do cadastro; sem foto (ou foto quebrada) mostra um bloco neutro no lugar. */
export function FotoDoProduto({ url, alt = '', className }: { url: string | null; alt?: string; className: string }) {
  const [quebrou, setQuebrou] = useState(false);
  if (!url || quebrou) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-brand-yellow/30 to-brand-red/15`} aria-hidden>
        <span className="text-3xl">🍽️</span>
      </div>
    );
  }
  return (
    // As fotos vêm do Storage do Supabase; o <img> evita configurar domínio no otimizador do Next.
    <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setQuebrou(true)} className={`${className} object-cover bg-surface-soft`} />
  );
}
