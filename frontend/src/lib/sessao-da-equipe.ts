'use client';

/**
 * Sessão de quem trabalha no restaurante (cozinha; garçom na fase 4), guardada no aparelho para a
 * tela da cozinha continuar aberta depois de recarregar. O token vale um turno (14 h) e a API o
 * confere a cada requisição: desativar o usuário ou trocar a senha derruba a sessão na hora.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Papel } from './api';

interface SessaoDaEquipe {
  token: string | null;
  nome: string;
  papel: Papel | null;
  restaurante: string;
  entrar: (dados: { token: string; nome: string; papel: Papel; restaurante: string }) => void;
  sair: () => void;
}

export const useSessaoDaEquipe = create<SessaoDaEquipe>()(
  persist(
    (set) => ({
      token: null,
      nome: '',
      papel: null,
      restaurante: '',
      entrar: (dados) => set(dados),
      sair: () => set({ token: null, nome: '', papel: null, restaurante: '' }),
    }),
    { name: 'easymenu-equipe', storage: createJSONStorage(() => (typeof window === 'undefined' ? undefined : localStorage)!) },
  ),
);
