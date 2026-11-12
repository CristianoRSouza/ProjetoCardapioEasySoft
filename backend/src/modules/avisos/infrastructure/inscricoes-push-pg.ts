import { Injectable } from '@nestjs/common';
import { DbService } from '../../../infra/db/db.service';
import { type InscricaoPush, InscricoesPush, type NovaInscricao } from '../application/portas';

@Injectable()
export class InscricoesPushPg extends InscricoesPush {
  constructor(private readonly db: DbService) {
    super();
  }

  override async salvar(i: NovaInscricao) {
    await this.db.query(
      `insert into cardapio.inscricoes_push (usuario_id, store_id, endpoint, p256dh, auth)
       values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update
         set usuario_id = excluded.usuario_id, store_id = excluded.store_id,
             p256dh = excluded.p256dh, auth = excluded.auth, updated_at = now()`,
      [i.usuarioId, i.storeId, i.endpoint, i.p256dh, i.auth],
    );
  }

  override async remover(usuarioId: string, endpoint: string) {
    await this.db.query('delete from cardapio.inscricoes_push where usuario_id = $1 and endpoint = $2', [usuarioId, endpoint]);
  }

  override async dosGarconsDaLoja(storeId: string): Promise<InscricaoPush[]> {
    const { rows } = await this.db.query<InscricaoPush>(
      `select p.id, p.endpoint, p.p256dh, p.auth
         from cardapio.inscricoes_push p
         join cardapio.usuarios u on u.id = p.usuario_id
        where p.store_id = $1 and u.store_id = $1 and u.ativo and u.papel = 'garcom'
        limit 100`,
      [storeId],
    );
    return rows;
  }

  override async apagar(ids: string[]) {
    if (ids.length) await this.db.query('delete from cardapio.inscricoes_push where id = any($1::uuid[])', [ids]);
  }
}
