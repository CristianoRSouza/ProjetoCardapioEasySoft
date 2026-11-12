'use client';

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center p-8 gap-4">
      <h1 className="font-display text-4xl">Algo deu errado</h1>
      <p className="text-muted-foreground">Tente de novo. Se continuar, chame o garçom.</p>
      <button onClick={reset} className="h-12 px-6 rounded-xl bg-brand-red text-primary-foreground font-black">
        Tentar de novo
      </button>
    </main>
  );
}
