import { Injectable } from '@nestjs/common';
import { ErroDeNegocio } from '../../../common/erros/erro-de-negocio';
import { DbService, violouUnicidade } from '../../../infra/db/db.service';
import type { Papel } from '../domain/sessao';
import {
  Equipe,
  type MudancasNoUsuario,
  type NovoUsuario,
  type UsuarioComSenha,
  type UsuarioDaEquipe,
} from '../application/portas';

interface Linha {
  id: string;
  company_id: string;
  store_id: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
  sessao_versao: number;
  senha_hash: string;
}

const COLUNAS = 'id, company_id, store_id, nome, login, papel, ativo, sessao_versao';

const usuario = (r: Linha): UsuarioDaEquipe => ({
  id: r.id,
  companyId: r.company_id,
  storeId: r.store_id,
  nome: r.nome,
  login: r.login,
  papel: r.papel,
  ativo: r.ativo,
  sessaoVersao: r.sessao_versao,
});

@Injectable()
export class EquipePg extends Equipe {
  constructor(private readonly db: DbService) {
    super();
  }

  override async buscarPorLogin(login: string): Promise<UsuarioComSenha | null> {
    const { rows } = await this.db.query<Linha>(
      `select ${COLUNAS}, senha_hash from cardapio.usuarios where lower(login) = lower($1)`,
      [login],
    );
    return rows[0] ? { ...usuario(rows[0]), senhaHash: rows[0].senha_hash } : null;
  }

  override async buscar(id: string): Promise<UsuarioDaEquipe | null> {
    const { rows } = await this.db.query<Linha>(`select ${COLUNAS} from cardapio.usuarios where id = $1`, [id]);
    return rows[0] ? usuario(rows[0]) : null;
  }

  override async listarDaLoja(storeId: string): Promise<UsuarioDaEquipe[]> {
    const { rows } = await this.db.query<Linha>(
      `select ${COLUNAS} from cardapio.usuarios where store_id = $1 order by ativo desc, papel, lower(nome)`,
      [storeId],
    );
    return rows.map(usuario);
  }

  override async criar(novo: NovoUsuario): Promise<UsuarioDaEquipe> {
    try {
      const { rows } = await this.db.query<Linha>(
        `insert into cardapio.usuarios (company_id, store_id, nome, login, senha_hash, papel)
         values ($1, $2, $3, $4, $5, $6)
         returning ${COLUNAS}`,
        [novo.companyId, novo.storeId, novo.nome, novo.login, novo.senhaHash, novo.papel],
      );
      return usuario(rows[0]!);
    } catch (e) {
      if (violouUnicidade(e)) {
        throw new ErroDeNegocio(409, 'login_em_uso', 'Este login já está em uso. Escolha outro.');
      }
      throw e;
    }
  }

  override async alterar(storeId: string, id: string, m: MudancasNoUsuario): Promise<UsuarioDaEquipe | null> {
    const { rows } = await this.db.query<Linha>(
      `update cardapio.usuarios
          set nome = coalesce($3, nome),
              senha_hash = coalesce($4, senha_hash),
              ativo = coalesce($5, ativo),
              sessao_versao = sessao_versao
                + case when $4::text is not null or ($5::boolean is not null and $5::boolean <> ativo) then 1 else 0 end,
              updated_at = now()
        where id = $1 and store_id = $2
        returning ${COLUNAS}`,
      [id, storeId, m.nome ?? null, m.senhaHash ?? null, m.ativo ?? null],
    );
    return rows[0] ? usuario(rows[0]) : null;
  }
}
