import type { Papel } from '../domain/sessao';

export interface UsuarioDaEquipe {
  id: string;
  companyId: string;
  storeId: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
  sessaoVersao: number;
}

export interface UsuarioComSenha extends UsuarioDaEquipe {
  senhaHash: string;
}

export interface NovoUsuario {
  companyId: string;
  storeId: string;
  nome: string;
  login: string;
  senhaHash: string;
  papel: Papel;
}

export interface MudancasNoUsuario {
  nome?: string;
  senhaHash?: string;
  ativo?: boolean;
}

/** Equipe do restaurante (cardapio.usuarios). */
export abstract class Equipe {
  /** Busca pelo login sem diferenciar maiúsculas. Devolve também inativo: quem decide é o serviço. */
  abstract buscarPorLogin(login: string): Promise<UsuarioComSenha | null>;
  abstract buscar(id: string): Promise<UsuarioDaEquipe | null>;
  abstract listarDaLoja(storeId: string): Promise<UsuarioDaEquipe[]>;
  /** Lança `login_em_uso` (409) se o login já existir. */
  abstract criar(novo: NovoUsuario): Promise<UsuarioDaEquipe>;
  /**
   * Só altera usuário DESTA loja. Trocar a senha ou o `ativo` sobe a `sessaoVersao`, derrubando as
   * sessões abertas. Devolve null se não achar.
   */
  abstract alterar(storeId: string, id: string, mudancas: MudancasNoUsuario): Promise<UsuarioDaEquipe | null>;
}
