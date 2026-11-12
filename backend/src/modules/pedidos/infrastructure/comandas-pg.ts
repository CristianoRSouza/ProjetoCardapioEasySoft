import { Injectable } from '@nestjs/common';
import { DbService, type Executor } from '../../../infra/db/db.service';
import { codigoDaComandaDaMesa, ORIGEM_CARDAPIO, type StatusNaCozinha } from '../domain/pedido';
import { Comandas, type EnvioDaMesa, type EnvioRegistrado, type NovoEnvio } from '../application/portas';

/**
 * Grava exatamente como o totem grava hoje (conferido nas comandas reais de homologação):
 *   command.orders       status 'open', totem_name, table_name
 *   command.order_items  origin 'totem', status 'active', product_id/barcode/name, unit_id, unit_code
 * Assim o pedido aparece na tela de Comandas do Manager sem nenhuma mudança no EasyFood.
 */
@Injectable()
export class ComandasPg extends Comandas {
  constructor(private readonly db: DbService) {
    super();
  }

  override registrarEnvio(envio: NovoEnvio): Promise<EnvioRegistrado> {
    return this.db.transacao(async (tx) => {
      // Dois celulares da mesma mesa enviando juntos: o lock serializa e os dois caem na MESMA comanda.
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`easymenu:${envio.storeId}:${envio.mesa}`]);
      const comanda = await this.comandaAbertaOuNova(tx, envio);

      const itensGravados: { id: string }[] = [];
      for (const item of envio.itens) {
        const { rows } = await tx.query<{ id: string }>(
          `insert into command.order_items
             (company_id, store_id, order_id, order_created_at, product_id, product_name, product_barcode,
              quantity, unit_price, subtotal, origin, status, unit_id, unit_code)
           values ($1, $2, $3, $4::timestamptz, $5, left($6, 200), left($7, 50), $8, $9, $10, 'totem', 'active', $11, $12)
           returning id`,
          [
            envio.companyId, envio.storeId, comanda.id, comanda.createdAt,
            item.produto.id, item.produto.nome, item.produto.codigoDeBarras,
            item.quantidade, item.precoUnitario, item.subtotal,
            item.produto.unidadeId, item.produto.unidadeCodigo,
          ],
        );
        itensGravados.push(rows[0]!);
      }
      await tx.query('update command.orders set updated_at = now() where id = $1 and created_at = $2::timestamptz', [
        comanda.id,
        comanda.createdAt,
      ]);

      const retrato = envio.itens.map((item, i) => ({
        order_item_id: itensGravados[i]!.id,
        product_id: item.produto.id,
        nome: item.produto.nome,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
        observacao: item.observacao,
      }));
      // garcom_id só existe depois da 0003_garcom: o pedido do QR não depende dela.
      const doGarcom = envio.garcomId !== null;
      const { rows } = await tx.query<{ id: string; numero: string }>(
        `insert into cardapio.envios
           (company_id, store_id, order_id, order_created_at, mesa, cliente, observacao, itens, total${doGarcom ? ', garcom_id' : ''})
         values ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8::jsonb, $9${doGarcom ? ', $10' : ''})
         returning id, numero`,
        [
          envio.companyId, envio.storeId, comanda.id, comanda.createdAt, envio.mesa,
          envio.cliente, envio.observacao, JSON.stringify(retrato), envio.total,
          ...(doGarcom ? [envio.garcomId] : []),
        ],
      );
      return { id: rows[0]!.id, numero: Number(rows[0]!.numero), comandaId: comanda.id };
    });
  }

  /**
   * `createdAt` volta como TEXTO de propósito: a coluna tem microssegundos e o Date do JS só guarda
   * milissegundos. Arredondado, o order_created_at do item não casa com a chave (id, created_at)
   * da comanda e a FK recusa o insert.
   */
  private async comandaAbertaOuNova(tx: Executor, envio: NovoEnvio): Promise<{ id: string; createdAt: string }> {
    const codigo = codigoDaComandaDaMesa(envio.mesa);
    const aberta = await tx.query<{ id: string; created_at: string }>(
      `select id, created_at::text as created_at from command.orders
        where store_id = $1 and barcode = $2 and status = 'open'
        order by created_at desc limit 1`,
      [envio.storeId, codigo],
    );
    if (aberta.rows[0]) return { id: aberta.rows[0].id, createdAt: aberta.rows[0].created_at };

    const nova = await tx.query<{ id: string; created_at: string }>(
      `insert into command.orders (company_id, store_id, barcode, customer_name, status, table_name, totem_name)
       values ($1, $2, $3, $4, 'open', $5, $6)
       returning id, created_at::text as created_at`,
      [envio.companyId, envio.storeId, codigo, envio.cliente, envio.mesa, ORIGEM_CARDAPIO],
    );
    return { id: nova.rows[0]!.id, createdAt: nova.rows[0]!.created_at };
  }

  /**
   * Os itens vêm do retrato do envio (nome e observação), mas quantidade, preço e situação são lidos
   * da comanda: o caixa pode ter cancelado, o garçom pode ter corrigido, a loja pode ter lançado.
   */
  override async enviosDaMesa(storeId: string, mesa: string): Promise<EnvioDaMesa[]> {
    const { rows } = await this.db.query<{
      id: string;
      numero: string;
      cliente: string;
      observacao: string | null;
      status: StatusNaCozinha;
      created_at: Date;
      pronto_em: Date | null;
      itens: {
        order_item_id: string;
        nome: string;
        quantidade: number;
        preco_unitario: number;
        observacao: string | null;
        cancelado: boolean;
        lancado: boolean;
      }[];
    }>(
      `select e.id, e.numero, e.cliente, e.observacao, e.status, e.created_at, e.pronto_em,
              coalesce((
                select jsonb_agg(jsonb_build_object(
                         'order_item_id', i.v ->> 'order_item_id',
                         'nome', i.v ->> 'nome',
                         'quantidade', coalesce(oi.quantity, (i.v ->> 'quantidade')::int),
                         'preco_unitario', coalesce(oi.unit_price, (i.v ->> 'preco_unitario')::numeric),
                         'observacao', nullif(i.v ->> 'observacao', ''),
                         'cancelado', coalesce(oi.status::text = 'cancelled', false),
                         'lancado', coalesce(oi.synced_to_fb, false)
                       ) order by i.n)
                  from jsonb_array_elements(e.itens) with ordinality as i(v, n)
                  left join command.order_items oi
                    on oi.id = (i.v ->> 'order_item_id')::uuid and oi.order_created_at = e.order_created_at
              ), '[]'::jsonb) as itens
         from cardapio.envios e
         join command.orders o on o.id = e.order_id and o.created_at = e.order_created_at
        where e.store_id = $1 and e.mesa = $2 and o.status = 'open'
        order by e.created_at`,
      [storeId, mesa],
    );
    return rows.map((r) => {
      const itens = r.itens.map((i) => ({
        orderItemId: i.order_item_id,
        nome: i.nome,
        quantidade: i.quantidade,
        precoUnitario: Number(i.preco_unitario),
        observacao: i.observacao,
        cancelado: i.cancelado,
        lancado: i.lancado,
      }));
      return {
        id: r.id,
        numero: Number(r.numero),
        cliente: r.cliente,
        observacao: r.observacao,
        status: r.status,
        criadoEm: r.created_at.toISOString(),
        prontoEm: r.pronto_em?.toISOString() ?? null,
        total: Math.round(itens.filter((i) => !i.cancelado).reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) * 100) / 100,
        itens,
      };
    });
  }
}
