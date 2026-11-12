import { Injectable } from '@nestjs/common';
import { DbService } from '../../../infra/db/db.service';
import type { StatusNaCozinha } from '../../pedidos/domain/pedido';
import { JANELA_DA_COZINHA_HORAS, PRONTOS_VISIVEIS_MIN } from '../domain/andamento';
import { FilaDaCozinha, type PedidoNaCozinha, type ResultadoDaMudanca } from '../application/portas';

@Injectable()
export class FilaDaCozinhaPg extends FilaDaCozinha {
  constructor(private readonly db: DbService) {
    super();
  }

  /**
   * Os itens vêm do retrato gravado no envio (com a observação de cada um). O status de cada item
   * é conferido na comanda: se o caixa ou o garçom cancelou, o card mostra riscado; se cancelou
   * tudo, o card some. Comanda cancelada e pedido já entregue também somem.
   */
  override async listar(storeId: string): Promise<PedidoNaCozinha[]> {
    const { rows } = await this.db.query<{
      id: string;
      numero: string;
      mesa: string;
      cliente: string;
      observacao: string | null;
      status: StatusNaCozinha;
      created_at: Date;
      iniciado_em: Date | null;
      pronto_em: Date | null;
      itens: { nome: string; quantidade: number; observacao: string | null; cancelado: boolean }[];
    }>(
      `select e.id, e.numero, e.mesa, e.cliente, e.observacao, e.status, e.created_at, e.iniciado_em, e.pronto_em,
              coalesce((
                select jsonb_agg(jsonb_build_object(
                         'nome', i.v ->> 'nome',
                         'quantidade', (i.v ->> 'quantidade')::int,
                         'observacao', nullif(i.v ->> 'observacao', ''),
                         'cancelado', coalesce(oi.status::text = 'cancelled', false)
                       ) order by i.n)
                  from jsonb_array_elements(e.itens) with ordinality as i(v, n)
                  left join command.order_items oi
                    on oi.id = (i.v ->> 'order_item_id')::uuid and oi.order_created_at = e.order_created_at
              ), '[]'::jsonb) as itens
         from cardapio.envios e
         join command.orders o on o.id = e.order_id and o.created_at = e.order_created_at
        where e.store_id = $1
          and o.status <> 'cancelled'
          and e.created_at > now() - make_interval(hours => $2)
          and (e.status in ('recebido', 'em_preparo')
               or (e.status = 'pronto' and e.pronto_em > now() - make_interval(mins => $3)))
        order by e.created_at
        limit 200`,
      [storeId, JANELA_DA_COZINHA_HORAS, PRONTOS_VISIVEIS_MIN],
    );
    return rows.filter((r) => r.itens.some((i) => !i.cancelado)).map((r) => ({
      id: r.id,
      numero: Number(r.numero),
      mesa: r.mesa,
      cliente: r.cliente,
      observacao: r.observacao,
      status: r.status,
      criadoEm: r.created_at.toISOString(),
      iniciadoEm: r.iniciado_em?.toISOString() ?? null,
      prontoEm: r.pronto_em?.toISOString() ?? null,
      itens: r.itens,
    }));
  }

  override async mudarStatus(
    storeId: string,
    envioId: string,
    de: StatusNaCozinha,
    para: StatusNaCozinha,
  ): Promise<ResultadoDaMudanca> {
    const { rows } = await this.db.query<{ numero: string; mesa: string; cliente: string }>(
      `update cardapio.envios
          set status = $4,
              iniciado_em = case when $4 = 'em_preparo' then coalesce(iniciado_em, now())
                                 when $4 = 'recebido' then null else iniciado_em end,
              pronto_em = case when $4 = 'pronto' then now() else null end,
              updated_at = now()
        where id = $1 and store_id = $2 and status = $3
        returning numero, mesa, cliente`,
      [envioId, storeId, de, para],
    );
    if (rows[0]) return { numero: Number(rows[0].numero), mesa: rows[0].mesa, cliente: rows[0].cliente };
    const existe = await this.db.query('select 1 from cardapio.envios where id = $1 and store_id = $2', [envioId, storeId]);
    return existe.rowCount ? 'status_mudou' : 'nao_encontrado';
  }
}
