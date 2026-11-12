'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Cardapio, ErroDaApi } from '@/lib/api';

// Cache da sessão: ir e voltar entre cardápio e produto não busca de novo.
const cache = new Map<string, { em: number; dados: Cardapio }>();
const VALIDADE_MS = 60_000;

export function useCardapio(token: string | null) {
  const emCache = token ? cache.get(token) : undefined;
  const [dados, setDados] = useState<Cardapio | null>(emCache?.dados ?? null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setErro(null);
    try {
      const novo = await api.cardapio(token);
      cache.set(token, { em: Date.now(), dados: novo });
      setDados(novo);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível carregar o cardápio.');
    }
  }, [token]);

  useEffect(() => {
    const atual = token ? cache.get(token) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com a API externa
    if (!atual || Date.now() - atual.em > VALIDADE_MS) void carregar();
  }, [token, carregar]);

  return { cardapio: dados, erro, recarregar: carregar };
}

export function invalidarCardapio(token: string) {
  cache.delete(token);
}
