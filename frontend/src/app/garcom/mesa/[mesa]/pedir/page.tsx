'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Carregando } from '@/components/cabecalho';
import { api, type Cardapio } from '@/lib/api';
import { formatarBRL } from '@/lib/formatar';
import { itensParaEnviar, mudarObservacao, mudarQuantidade, resumoDoPedido, type PedidoDoGarcom } from '@/lib/garcom';
import { AreaDoGarcom, CabecalhoDoGarcom, type Garcom } from '../../../area';

/** O garçom monta o pedido da mesa com o mesmo cardápio do cliente e manda para a cozinha. */
export default function PedirPeloGarcom() {
  return <AreaDoGarcom>{(g) => <Pedir {...g} />}</AreaDoGarcom>;
}

function Pedir({ token, tratarErro }: Garcom) {
  const router = useRouter();
  const { mesa: bruta } = useParams<{ mesa: string }>();
  const mesa = decodeURIComponent(bruta);
  const [cardapio, setCardapio] = useState<Omit<Cardapio, 'mesa'> | null>(null);
  const [pedido, setPedido] = useState<PedidoDoGarcom>({});
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .cardapioDoGarcom(token)
      .then((c) => ativo && setCardapio(c))
      .catch((e: unknown) => ativo && setErro(tratarErro(e)));
    return () => {
      ativo = false;
    };
  }, [token, tratarErro]);

  if (!cardapio) return erro ? <p className="p-6 text-destructive font-bold">{erro}</p> : <Carregando />;

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const visiveis = cardapio.produtos.filter((p) => !termo || p.nome.toLocaleLowerCase('pt-BR').includes(termo));
  const { itens, total } = resumoDoPedido(pedido, cardapio.produtos);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.pedirPeloGarcom(token, mesa, {
        ...(cliente.trim() ? { cliente: cliente.trim() } : {}),
        itens: itensParaEnviar(pedido, cardapio.produtos),
      });
      router.replace(`/garcom/mesa/${encodeURIComponent(mesa)}`);
    } catch (e) {
      setErro(tratarErro(e));
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <CabecalhoDoGarcom titulo={`Pedido · Mesa ${mesa}`} voltarPara={`/garcom/mesa/${encodeURIComponent(mesa)}`} />

      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b border-border px-3 py-2.5">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto"
          aria-label="Buscar produto"
          className="w-full h-11 px-4 rounded-full bg-card border border-border outline-none focus:border-brand-red"
        />
      </div>

      <main className={`flex-1 px-3 pt-3 ${itens ? 'pb-56' : 'pb-8'}`}>
        {visiveis.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{termo ? 'Nada encontrado com essa busca.' : 'O cardápio está vazio.'}</p>
        ) : (
          <ul className="divide-y divide-border bg-card rounded-2xl border border-border overflow-hidden">
            {visiveis.map((p) => {
              const linha = pedido[p.id];
              return (
                <li key={p.id} className={`p-3 ${linha ? 'bg-surface-soft' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold leading-tight">{p.nome}</p>
                      <p className="text-sm font-black tabular-nums mt-0.5">{formatarBRL(p.preco)}</p>
                    </div>
                    {linha ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setPedido((x) => mudarQuantidade(x, p.id, -1))}
                          aria-label={`Tirar um ${p.nome}`}
                          className="size-10 rounded-full bg-secondary text-xl font-black"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-black tabular-nums">{linha.quantidade}</span>
                        <button
                          onClick={() => setPedido((x) => mudarQuantidade(x, p.id, 1))}
                          aria-label={`Mais um ${p.nome}`}
                          className="size-10 rounded-full bg-brand-red text-primary-foreground text-xl font-black"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPedido((x) => mudarQuantidade(x, p.id, 1))}
                        aria-label={`Adicionar ${p.nome}`}
                        className="size-11 rounded-full bg-brand-red text-primary-foreground text-2xl flex items-center justify-center active:scale-90 transition-transform shrink-0"
                      >
                        +
                      </button>
                    )}
                  </div>
                  {linha && (
                    <input
                      value={linha.observacao}
                      onChange={(e) => setPedido((x) => mudarObservacao(x, p.id, e.target.value))}
                      placeholder="Observação (ex.: sem cebola)"
                      aria-label={`Observação de ${p.nome}`}
                      maxLength={140}
                      className="mt-2 w-full h-10 px-3 rounded-lg border border-border bg-card text-sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {itens > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-[480px] bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 animate-subir">
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            maxLength={40}
            placeholder="Para quem? (opcional)"
            aria-label="Nome do cliente"
            className="w-full h-11 px-3 rounded-xl border border-border bg-background"
          />
          {erro && (
            <p role="alert" className="text-sm text-destructive font-bold">
              {erro}
            </p>
          )}
          <button
            onClick={() => void enviar()}
            disabled={enviando}
            className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider flex items-center justify-between px-5 disabled:opacity-50"
          >
            <span className="tabular-nums">{itens}</span>
            <span>{enviando ? 'Enviando…' : 'Enviar para a cozinha'}</span>
            <span className="tabular-nums">{formatarBRL(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
