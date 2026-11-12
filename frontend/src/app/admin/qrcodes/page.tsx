'use client';

import QRCode from 'qrcode';
import { useState } from 'react';
import { api, ErroDaApi } from '@/lib/api';
import { expandirMesas } from '@/lib/formatar';

interface QrGerado {
  mesa: string;
  url: string;
  imagem: string;
}

/**
 * Gera os QR codes para colar nas mesas. Cada QR leva um link assinado pela API com a loja e a
 * mesa — não dá para "fabricar" o QR de outra mesa trocando o número no link.
 * A chave de administrador fica só na memória desta aba.
 */
export default function AdminQrCodes() {
  const [chave, setChave] = useState('');
  const [storeId, setStoreId] = useState('');
  const [mesas, setMesas] = useState('1-10');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ restaurante: string; qrcodes: QrGerado[] } | null>(null);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const r = await api.gerarQrCodes(chave.trim(), storeId.trim(), expandirMesas(mesas));
      const qrcodes = await Promise.all(
        r.qrcodes.map(async (q) => ({ ...q, imagem: await QRCode.toDataURL(q.url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }) })),
      );
      setResultado({ restaurante: r.restaurante, qrcodes });
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível gerar.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <main className="min-h-dvh p-4 space-y-4">
      <section className="nao-imprimir bg-card rounded-2xl border border-border p-4 space-y-3">
        <h1 className="font-display text-3xl">QR codes das mesas</h1>
        <label className="block text-sm font-bold">
          Chave de administrador
          <input type="password" value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" className="mt-1 w-full h-11 px-3 rounded-xl border-2 border-border bg-background" />
        </label>
        <label className="block text-sm font-bold">
          Id da loja (pv_stores.id)
          <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1 w-full h-11 px-3 rounded-xl border-2 border-border bg-background font-mono text-sm" />
        </label>
        <label className="block text-sm font-bold">
          Mesas (ex.: 1-20, 25, VIP1)
          <input value={mesas} onChange={(e) => setMesas(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border-2 border-border bg-background" />
        </label>
        {erro && <p role="alert" className="text-destructive text-sm font-bold">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={() => void gerar()} disabled={gerando || !chave || !storeId} className="h-12 px-5 rounded-xl bg-brand-red text-primary-foreground font-black disabled:opacity-40">
            {gerando ? 'Gerando…' : 'Gerar'}
          </button>
          {resultado && (
            <button onClick={() => window.print()} className="h-12 px-5 rounded-xl bg-secondary font-black">
              Imprimir
            </button>
          )}
        </div>
      </section>

      {resultado && (
        <section className="grid grid-cols-2 gap-3">
          {resultado.qrcodes.map((q) => (
            <figure key={q.mesa} className="bg-white rounded-2xl border border-border p-3 text-center break-inside-avoid">
              <img src={q.imagem} alt={`QR code da mesa ${q.mesa}`} className="w-full h-auto" />
              <figcaption className="mt-2">
                <span className="block font-display text-3xl leading-none">Mesa {q.mesa}</span>
                <span className="block text-xs text-muted-foreground mt-1">{resultado.restaurante} · aponte a câmera para pedir</span>
              </figcaption>
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
