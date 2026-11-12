import { Injectable } from '@nestjs/common';
import { DbService } from '../../../infra/db/db.service';
import { type Loja, Lojas } from '../application/portas';

@Injectable()
export class LojasPg extends Lojas {
  constructor(private readonly db: DbService) {
    super();
  }

  override async buscar(storeId: string): Promise<Loja | null> {
    const { rows } = await this.db.query<{ id: string; company_id: string; nome: string }>(
      `select id, company_id, coalesce(nullif(trade_name, ''), legal_name, 'Restaurante') as nome
         from public.pv_stores
        where id = $1 and is_active and not coalesce(is_deleted, false)`,
      [storeId],
    );
    const r = rows[0];
    return r ? { id: r.id, companyId: r.company_id, nome: r.nome } : null;
  }
}
