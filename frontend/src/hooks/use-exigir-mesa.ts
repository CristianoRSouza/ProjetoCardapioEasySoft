'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessaoDaMesa } from '@/lib/sessao-da-mesa';
import { useMontado } from './use-montado';

/**
 * Telas de pedido só existem com uma mesa lida no QR e um nome informado. Sem isso o cliente
 * volta para a tela que explica como ler o QR code.
 */
export function useExigirMesa() {
  const montado = useMontado();
  const { token, mesa, cliente, restaurante } = useSessaoDaMesa();
  const router = useRouter();
  const pronto = montado && Boolean(token && cliente);

  useEffect(() => {
    if (montado && !(token && cliente)) router.replace(token ? `/mesa/${token}` : '/');
  }, [montado, token, cliente, router]);

  return pronto ? { token: token!, mesa: mesa!, cliente, restaurante } : null;
}
