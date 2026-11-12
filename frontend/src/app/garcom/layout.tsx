import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Instalável na Tela de Início (no iPhone é a única forma de receber push).
export const metadata: Metadata = {
  title: 'EasyMenu Garçom',
  manifest: '/garcom.webmanifest',
  appleWebApp: { capable: true, title: 'Garçom', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icones/garcom-180.png' },
};

export default function LayoutDoGarcom({ children }: { children: ReactNode }) {
  return children;
}
