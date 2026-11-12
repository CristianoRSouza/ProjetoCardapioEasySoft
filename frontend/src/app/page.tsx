import { Logo } from '@/components/cabecalho';

/** Quem abre o site sem QR code cai aqui. Não existe atalho para escolher mesa: só o QR identifica. */
export default function Inicio() {
  return (
    <main className="min-h-dvh flex flex-col px-6 py-10">
      <div className="flex items-center gap-2">
        <Logo tamanho="lg" />
        <p className="font-display text-2xl tracking-wide">
          <span className="text-brand-red">Easy</span>Menu
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center text-center gap-5">
        <div className="mx-auto size-40 rounded-3xl border-4 border-dashed border-brand-red/40 bg-card flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="size-20 text-brand-red" fill="currentColor" aria-hidden>
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h2v2h-2v-2zm4 0h4v2h-4v-2zm-4 4h2v4h-2v-4zm4 2h2v2h-2v-2zm2-2h2v2h-2v-2zm0 4h2v2h-2v-2z" />
          </svg>
        </div>
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-foreground">
          Leia o QR code
          <br />
          da sua mesa
        </h1>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Abra a câmera do celular e aponte para o QR code colado na mesa. O cardápio abre já com a sua mesa identificada.
        </p>
      </div>
    </main>
  );
}
