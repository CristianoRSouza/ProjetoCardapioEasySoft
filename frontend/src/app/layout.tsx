import type { Metadata, Viewport } from 'next';
import { Barlow, Bebas_Neue } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const titulo = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--fonte-titulo', display: 'swap' });
const texto = Barlow({ weight: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'], variable: '--fonte-texto', display: 'swap' });

export const metadata: Metadata = {
  title: 'EasyMenu — Cardápio digital da mesa',
  description: 'Leia o QR code da mesa, monte seu pedido e envie direto para a cozinha.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d92b2b',
};

export default function Raiz({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        <div className="min-h-dvh w-full bg-muted">
          <div className="relative mx-auto w-full max-w-[480px] min-h-dvh bg-background shadow-2xl">{children}</div>
        </div>
      </body>
    </html>
  );
}
