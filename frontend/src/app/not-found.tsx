import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center p-8 gap-4">
      <h1 className="font-display text-7xl">404</h1>
      <p className="text-muted-foreground">Esta página não existe. Leia de novo o QR code da sua mesa.</p>
      <Link href="/" className="h-12 px-6 rounded-xl bg-brand-red text-primary-foreground font-black flex items-center">
        Início
      </Link>
    </main>
  );
}
