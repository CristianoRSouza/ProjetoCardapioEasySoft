'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Carregando, TelaCheia } from '@/components/cabecalho';
import { useMontado } from '@/hooks/use-montado';
import { api, ErroDaApi, type PedidoDaMesa } from '@/lib/api';
import { useCarrinho } from '@/lib/carrinho';
import { useSessaoDaMesa } from '@/lib/sessao-da-mesa';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'invalido'; mensagem: string }
  | { tipo: 'ok'; mesa: string; restaurante: string; pedidos: PedidoDaMesa[] };

/** Destino do QR code. Confirma a mesa com a API e pede só o nome do cliente. */
export default function EntradaDaMesa() {
  const { token } = useParams<{ token: string }>();
  const montado = useMontado();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [nome, setNome] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [mesa, daMesa] = await Promise.all([api.abrirMesa(token), api.pedidosDaMesa(token)]);
        if (!ativo) return;
        const sessao = useSessaoDaMesa.getState();
        // Leu o QR de outra mesa: o carrinho montado para a anterior não vale aqui.
        if (sessao.token && sessao.token !== token) useCarrinho.getState().limpar();
        sessao.entrarNaMesa({ token, mesa: mesa.mesa, restaurante: mesa.restaurante });
        setNome(sessao.cliente);
        setEstado({ tipo: 'ok', ...mesa, pedidos: daMesa.pedidos });
      } catch (e) {
        if (!ativo) return;
        setEstado({
          tipo: 'invalido',
          mensagem: e instanceof ErroDaApi ? e.message : 'Não foi possível abrir a mesa. Tente de novo.',
        });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  if (!montado || estado.tipo === 'carregando') return <Carregando />;

  if (estado.tipo === 'invalido') {
    return (
      <TelaCheia>
        <h1 className="font-display text-4xl">Não abriu a mesa</h1>
        <p className="text-muted-foreground">{estado.mensagem}</p>
        <Link href="/" className="h-12 px-6 rounded-xl bg-brand-red text-primary-foreground font-black flex items-center">
          Voltar
        </Link>
      </TelaCheia>
    );
  }

  const nomeLimpo = nome.trim();
  const temPedidos = estado.pedidos.length > 0;

  const comecar = () => {
    if (nomeLimpo.length < 2) return;
    useSessaoDaMesa.getState().definirCliente(nomeLimpo);
    router.push('/cardapio');
  };

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="bg-brand-red text-primary-foreground px-6 pt-10 pb-12 rounded-b-[2rem]">
        <p className="text-xs font-black uppercase tracking-[0.25em] opacity-80">{estado.restaurante}</p>
        <h1 className="font-display text-7xl leading-none mt-1">Mesa {estado.mesa}</h1>
        <p className="mt-2 opacity-90">Peça pelo celular e acompanhe o preparo daqui mesmo.</p>
      </div>

      <div className="flex-1 px-6 -mt-6 space-y-4 pb-8">
        {temPedidos && (
          <Link
            href="/minha-mesa"
            onClick={() => nomeLimpo.length >= 2 && useSessaoDaMesa.getState().definirCliente(nomeLimpo)}
            className="block rounded-2xl bg-card border-2 border-brand-yellow p-4 shadow-sm active:scale-[0.99] transition-transform"
          >
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pedidos desta mesa</p>
            <p className="font-bold mt-1">
              {estado.pedidos.length} {estado.pedidos.length === 1 ? 'pedido enviado' : 'pedidos enviados'} · ver andamento →
            </p>
          </Link>
        )}

        <form
          className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            comecar();
          }}
        >
          <div>
            <label htmlFor="nome" className="block font-bold mb-1.5">
              Como podemos te chamar?
            </label>
            <input
              id="nome"
              autoComplete="given-name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={40}
              placeholder="Seu nome"
              className="w-full h-14 px-4 rounded-xl bg-background border-2 border-border text-lg outline-none focus:border-brand-red"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Usamos para identificar seu pedido na mesa.</p>
          </div>
          <button
            type="submit"
            disabled={nomeLimpo.length < 2}
            className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {temPedidos ? 'Pedir mais' : 'Ver cardápio'}
          </button>
        </form>
      </div>
    </main>
  );
}
