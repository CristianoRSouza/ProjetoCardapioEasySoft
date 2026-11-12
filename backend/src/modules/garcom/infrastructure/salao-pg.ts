import { Injectable } from '@nestjs/common';
import { DbService } from '../../../infra/db/db.service';
import type { StatusNaCozinha } from '../../pedidos/domain/pedido';
import { bloqueioDoItem, JANELA_DAS_MESAS_HORAS, PRONTOS_PARA_LEVAR_HORAS } from '../domain/edicao';
import {
  type AlteracaoDeItem,
  type ProntoParaLevar,
  type ResultadoDaAlteracao,
  type ResumoDaMesa,
  Salao,
} from '../application/portas';

interface ItemDoRetrato {
  order_item_id: string;
  product_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  cancelado?: boolean;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class SalaoPg extends Salao {
  constructor(private readonly db: DbService) {
    super();
  }

  override async mesasAbertas(storeId: string): Promise<ResumoDaMesa[]> {
    const { rows } = await this.db.query<{
      mesa: string;
      aberta_em: Date;
      ultimo: Date;
      pedidos: number;
      na_cozinha: number;
      prontos: number;
      total: string;
    }>(
      `with envios as (
         select e.mesa, e.status, e.created_at, e.pronto_em, e.order_id, e.order_created_at, o.created_at as aberta_em
           from cardapio.envios e
           join command.orders o on o.id = e.order_id and o.created_at = e.order_created_at
          where e.store_id = $1 and o.status = 'open' and e.created_at > now() - make_interval(hours => $2)
       ),
       comandas as (select distinct mesa, order_id, order_created_at from envios)
       select v.mesa, min(v.aberta_em) as aberta_em, max(v.created_at) as ultimo,
              count(*)::int as pedidos,
              count(*) filter (where v.status in ('recebido', 'em_preparo'))::int as na_cozinha,
              -- mesma janela da lista de prontos: o card da mesa não pode contar um pronto que a lista não mostra
              count(*) filter (where v.status = 'pronto' and v.pronto_em > now() - make_interval(hours => $3))::int as prontos,
              (select coalesce(sum(oi.subtotal), 0)
                 from comandas c
                 join command.order_items oi on oi.order_id = c.order_id and oi.order_created_at = c.order_created_at
                where c.mesa = v.mesa and oi.status = 'active')::text as total
         from envios v
        group by v.mesa`,
      [storeId, JANELA_DAS_MESAS_HORAS, PRONTOS_PARA_LEVAR_HORAS],
    );
    return rows.map((r) => ({
      mesa: r.mesa,
      abertaEm: r.aberta_em.toISOString(),
      ultimoPedidoEm: r.ultimo.toISOString(),
      pedidos: r.pedidos,
      naCozinha: r.na_cozinha,
      prontos: r.prontos,
      total: Number(r.total),
    }));
  }

  override async prontos(storeId: string): Promise<ProntoParaLevar[]> {
    const { rows } = await this.db.query<{
      id: string;
      numero: string;
      mesa: string;
      cliente: string;
      pronto_em: Date;
      itens: ProntoParaLevar['itens'];
    }>(
      `select e.id, e.numero, e.mesa, e.cliente, e.pronto_em,
              coalesce((
                select jsonb_agg(jsonb_build_object(
                         'nome', i.v ->> 'nome',
                         'quantidade', coalesce(oi.quantity, (i.v ->> 'quantidade')::int),
                         'observacao', nullif(i.v ->> 'observacao', ''),
                         'cancelado', coalesce(oi.status::text = 'cancelled', false)
                       ) order by i.n)
                  from jsonb_array_elements(e.itens) with ordinality as i(v, n)
                  left join command.order_items oi
                    on oi.id = (i.v ->> 'order_item_id')::uuid and oi.order_created_at = e.order_created_at
              ), '[]'::jsonb) as itens
         from cardapio.envios e
         join command.orders o on o.id = e.order_id and o.created_at = e.order_created_at
        where e.store_id = $1 and e.status = 'pronto' and o.status <> 'cancelled'
          and e.pronto_em > now() - make_interval(hours => $2)
        order by e.pronto_em
        limit 100`,
      [storeId, PRONTOS_PARA_LEVAR_HORAS],
    );
    return rows.map((r) => ({
      id: r.id,
      numero: Number(r.numero),
      mesa: r.mesa,
      cliente: r.cliente,
      prontoEm: r.pronto_em.toISOString(),
      itens: r.itens,
    }));
  }

  override alterarItem(a: AlteracaoDeItem): Promise<ResultadoDaAlteracao> {
    return this.db.transacao(async (tx) => {
      // Trava o envio: a cozinha (update ... where status = 'recebido') espera esta transação.
      const envio = (
        await tx.query<{
          company_id: string;
          status: StatusNaCozinha;
          order_id: string;
          order_created_at: string;
          itens: ItemDoRetrato[];
        }>(
          `select company_id, status, order_id, order_created_at::text as order_created_at, itens
             from cardapio.envios where id = $1 and store_id = $2 for update`,
          [a.envioId, a.storeId],
        )
      ).rows[0];
      if (!envio) return 'nao_encontrado';
      const posicao = envio.itens.findIndex((i) => i.order_item_id === a.orderItemId);
      if (posicao < 0) return 'nao_encontrado';

      const comanda = (
        await tx.query<{ status: string }>('select status::text from command.orders where id = $1 and created_at = $2::timestamptz', [
          envio.order_id,
          envio.order_created_at,
        ])
      ).rows[0];
      if (comanda?.status !== 'open') return 'comanda_fechada';

      // Trava o item: o Sync, ao marcar synced_to_fb vindo da loja, espera esta transação.
      const item = (
        await tx.query<{ quantity: number; unit_price: string; status: string; synced_to_fb: boolean; product_name: string }>(
          `select quantity, unit_price::text, status::text, synced_to_fb, product_name
             from command.order_items
            where id = $1 and order_created_at = $2::timestamptz and order_id = $3 and origin = 'totem'
            for update`,
          [a.orderItemId, envio.order_created_at, envio.order_id],
        )
      ).rows[0];
      if (!item) return 'nao_encontrado';
      const bloqueio = bloqueioDoItem(envio.status, { cancelado: item.status === 'cancelled', lancado: item.synced_to_fb });
      if (bloqueio) return bloqueio;
      if (a.quantidade === item.quantity) return 'ok';

      const preco = Number(item.unit_price);
      if (a.quantidade === 0) {
        await tx.query(
          `update command.order_items set status = 'cancelled', updated_at = now()
            where id = $1 and order_created_at = $2::timestamptz`,
          [a.orderItemId, envio.order_created_at],
        );
      } else {
        await tx.query(
          `update command.order_items set quantity = $3, subtotal = $4, updated_at = now()
            where id = $1 and order_created_at = $2::timestamptz`,
          [a.orderItemId, envio.order_created_at, a.quantidade, centavos(preco * a.quantidade)],
        );
      }

      // O retrato do envio acompanha (é o que a cozinha e a loja leem) e o total é refeito.
      const itens = envio.itens.map((i, n) =>
        n !== posicao ? i : a.quantidade === 0 ? { ...i, cancelado: true } : { ...i, quantidade: a.quantidade },
      );
      const total = centavos(itens.filter((i) => !i.cancelado).reduce((s, i) => s + i.preco_unitario * i.quantidade, 0));
      await tx.query('update cardapio.envios set itens = $2::jsonb, total = $3, updated_at = now() where id = $1', [
        a.envioId,
        JSON.stringify(itens),
        total,
      ]);
      await tx.query('update command.orders set updated_at = now() where id = $1 and created_at = $2::timestamptz', [
        envio.order_id,
        envio.order_created_at,
      ]);
      await tx.query(
        `insert into cardapio.alteracoes
           (company_id, store_id, envio_id, order_item_id, usuario_id, produto, quantidade_antes, quantidade_depois)
         values ($1, $2, $3, $4, $5, left($6, 200), $7, $8)`,
        [envio.company_id, a.storeId, a.envioId, a.orderItemId, a.usuarioId, item.product_name, item.quantity, a.quantidade],
      );
      return 'ok';
    });
  }

  override async marcarEntregue(storeId: string, envioId: string) {
    const { rowCount } = await this.db.query(
      `update cardapio.envios set status = 'entregue', entregue_em = now(), updated_at = now()
        where id = $1 and store_id = $2 and status = 'pronto'`,
      [envioId, storeId],
    );
    if (rowCount) return 'ok' as const;
    const existe = await this.db.query('select 1 from cardapio.envios where id = $1 and store_id = $2', [envioId, storeId]);
    return existe.rowCount ? ('status_mudou' as const) : ('nao_encontrado' as const);
  }
}
