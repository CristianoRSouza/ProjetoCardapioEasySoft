import { Injectable, Logger } from '@nestjs/common';
import { Config } from '../../../config/config.module';
import { ErroDeNegocio, naoEncontrado } from '../../../common/erros/erro-de-negocio';
import { Lojas, type Loja } from '../../mesa/application/portas';
import { conferirSenha, gerarHashDeSenha, HASH_DE_ENGANO } from '../domain/senha';
import { gerarSessao, lerSessao, type Papel } from '../domain/sessao';
import { Equipe, type UsuarioDaEquipe } from './portas';

export interface Logado {
  usuario: UsuarioDaEquipe;
  loja: Loja;
}

export interface UsuarioParaTela {
  id: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
}

const naTela = (u: UsuarioDaEquipe): UsuarioParaTela => ({
  id: u.id,
  nome: u.nome,
  login: u.login,
  papel: u.papel,
  ativo: u.ativo,
});

const loginInvalido = () => new ErroDeNegocio(401, 'login_invalido', 'Usuário ou senha incorretos.');
const sessaoEncerrada = () =>
  new ErroDeNegocio(401, 'sessao_encerrada', 'Sua sessão terminou. Entre de novo com usuário e senha.');

@Injectable()
export class EquipeService {
  private readonly log = new Logger('Equipe');

  constructor(
    private readonly equipe: Equipe,
    private readonly lojas: Lojas,
    private readonly config: Config,
  ) {}

  /** Usuário inexistente, senha errada, inativo ou loja desativada: a MESMA resposta. */
  async entrar(login: string, senha: string) {
    const usuario = await this.equipe.buscarPorLogin(login.trim());
    const confere = await conferirSenha(senha, usuario?.senhaHash ?? (await HASH_DE_ENGANO));
    const loja = usuario && confere && usuario.ativo ? await this.lojas.buscar(usuario.storeId) : null;
    if (!usuario || !loja) throw loginInvalido();

    const token = gerarSessao(
      { usuarioId: usuario.id, storeId: usuario.storeId, papel: usuario.papel, versao: usuario.sessaoVersao },
      this.config.valores.QR_TOKEN_SECRET,
    );
    this.log.log(`entrou: ${usuario.login} (${usuario.papel}) loja=${loja.id}`);
    return { token, usuario: naTela(usuario), restaurante: loja.nome };
  }

  /**
   * Valida a sessão a cada requisição: além da assinatura e da validade, confere no banco que o
   * usuário continua ativo, com a mesma versão de sessão e na mesma loja ativa.
   */
  async validar(token: string, papeis: readonly Papel[]): Promise<Logado> {
    const sessao = lerSessao(token, this.config.valores.QR_TOKEN_SECRET);
    if (!sessao) throw sessaoEncerrada();
    const usuario = await this.equipe.buscar(sessao.usuarioId);
    if (
      !usuario ||
      !usuario.ativo ||
      usuario.sessaoVersao !== sessao.versao ||
      usuario.storeId !== sessao.storeId ||
      usuario.papel !== sessao.papel
    ) {
      throw sessaoEncerrada();
    }
    if (!papeis.includes(usuario.papel)) {
      throw new ErroDeNegocio(403, 'sem_permissao', 'Seu usuário não tem acesso a esta tela.');
    }
    const loja = await this.lojas.buscar(usuario.storeId);
    if (!loja) throw sessaoEncerrada();
    return { usuario, loja };
  }

  // ---------- administração (X-Admin-Key) ----------

  async listar(storeId: string) {
    const loja = await this.lojaAtiva(storeId);
    return { restaurante: loja.nome, usuarios: (await this.equipe.listarDaLoja(storeId)).map(naTela) };
  }

  async criar(dados: { storeId: string; nome: string; login: string; senha: string; papel: Papel }) {
    const loja = await this.lojaAtiva(dados.storeId);
    const criado = await this.equipe.criar({
      companyId: loja.companyId,
      storeId: loja.id,
      nome: dados.nome.trim(),
      login: dados.login.trim(),
      senhaHash: await gerarHashDeSenha(dados.senha),
      papel: dados.papel,
    });
    this.log.log(`usuário criado: ${criado.login} (${criado.papel}) loja=${loja.id}`);
    return naTela(criado);
  }

  async alterar(storeId: string, id: string, dados: { nome?: string; senha?: string; ativo?: boolean }) {
    const alterado = await this.equipe.alterar(storeId, id, {
      nome: dados.nome?.trim(),
      senhaHash: dados.senha ? await gerarHashDeSenha(dados.senha) : undefined,
      ativo: dados.ativo,
    });
    if (!alterado) throw naoEncontrado('usuario_nao_encontrado', 'Usuário não encontrado nesta loja.');
    return naTela(alterado);
  }

  private async lojaAtiva(storeId: string) {
    const loja = await this.lojas.buscar(storeId);
    if (!loja) throw naoEncontrado('loja_nao_encontrada', 'Loja não encontrada ou inativa.');
    return loja;
  }
}
