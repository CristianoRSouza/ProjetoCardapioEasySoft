'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Bipe de aviso (pedido novo na cozinha, prato pronto no garçom), sintetizado (sem arquivo de áudio). O navegador só libera som depois de um
 * toque na página: até lá aparece o botão "Ativar som".
 */
export function useBipe() {
  const contexto = useRef<AudioContext | null>(null);
  const [liberado, setLiberado] = useState(false);

  const liberar = useCallback(() => {
    contexto.current ??= new AudioContext();
    void contexto.current.resume().then(() => setLiberado(contexto.current?.state === 'running'));
  }, []);

  // Qualquer toque na tela (o login, por exemplo) já libera o som.
  useEffect(() => {
    window.addEventListener('pointerdown', liberar, { once: true });
    return () => window.removeEventListener('pointerdown', liberar);
  }, [liberar]);

  const tocar = useCallback(() => {
    const ctx = contexto.current;
    if (!ctx || ctx.state !== 'running') return;
    [0, 0.22].forEach((atraso) => {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      osc.frequency.value = 880;
      volume.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      volume.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + atraso + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.18);
      osc.connect(volume).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.2);
    });
  }, []);

  return useMemo(() => ({ liberado, liberar, tocar }), [liberado, liberar, tocar]);
}
