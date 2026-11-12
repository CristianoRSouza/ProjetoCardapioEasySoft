'use client';

/**
 * Mesa lida no QR code e nome do cliente, guardados no celular para sobreviver a recarregamentos.
 * O token é o próprio QR assinado: é ele que vai para a API, nunca o número da mesa solto.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SessaoDaMesa {
  token: string | null;
  mesa: string | null;
  restaurante: string;
  cliente: string;
  entrarNaMesa: (dados: { token: string; mesa: string; restaurante: string }) => void;
  definirCliente: (nome: string) => void;
}

export const useSessaoDaMesa = create<SessaoDaMesa>()(
  persist(
    (set) => ({
      token: null,
      mesa: null,
      restaurante: '',
      cliente: '',
      entrarNaMesa: ({ token, mesa, restaurante }) => set({ token, mesa, restaurante }),
      definirCliente: (cliente) => set({ cliente }),
    }),
    // O Node 26 tem um localStorage global experimental: no servidor não há celular, então nada de armazenamento.
    { name: 'easymenu-mesa', storage: createJSONStorage(() => (typeof window === 'undefined' ? undefined : localStorage)!) },
  ),
);
