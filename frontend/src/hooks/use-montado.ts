'use client';

import { useSyncExternalStore } from 'react';

const nada = () => () => {};

/**
 * false no HTML do servidor, true no navegador. As telas leem o carrinho e a mesa do
 * armazenamento do celular, que não existe no servidor: renderizar só depois evita divergência.
 */
export function useMontado() {
  return useSyncExternalStore(nada, () => true, () => false);
}
