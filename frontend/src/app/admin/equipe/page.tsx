'use client';

import { useState } from 'react';
import { api, ErroDaApi, type Papel, type UsuarioDaEquipe } from '@/lib/api';

const ROTULO_DO_PAPEL: Record<Papel, string> = { cozinha: 'Cozinha', garcom: 'Garçom' };
const campo = 'mt-1 w-full h-11 px-3 rounded-xl border-2 border-border bg-background';

/**
 * Cadastro de quem entra na tela da cozinha (e, na fase 4, no app do garçom). Mesma chave de
 * administrador dos QR codes, guardada só na memória desta aba.
 */
export default function AdminEquipe() {
  const [chave, setChave] = useState('');
  const [storeId, setStoreId] = useState('');
  const [lista, setLista] = useState<{ restaurante: string; usuarios: UsuarioDaEquipe[] } | null>(null);
  const [novo, setNovo] = useState({ nome: '', login: '', senha: '', papel: 'cozinha' as Papel });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>, sucesso?: string) => {
    setOcupado(true);
    setErro(null);
    setOk(null);
    try {
      await acao();
      if (sucesso) setOk(sucesso);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };

  const carregar = () => executar(async () => setLista(await api.listarEquipe(chave.trim(), storeId.trim())));

  const criar = () =>
    executar(async () => {
      await api.criarUsuario(chave.trim(), { storeId: storeId.trim(), ...novo, login: novo.login.trim() });
      setNovo({ nome: '', login: '', senha: '', papel: novo.papel });
      setLista(await api.listarEquipe(chave.trim(), storeId.trim()));
    }, 'Usuário criado.');

  const alterar = (u: UsuarioDaEquipe, dados: { senha?: string; ativo?: boolean }, sucesso: string) =>
    executar(async () => {
      await api.alterarUsuario(chave.trim(), u.id, { storeId: storeId.trim(), ...dados });
      setLista(await api.listarEquipe(chave.trim(), storeId.trim()));
    }, sucesso);

  const trocarSenha = (u: UsuarioDaEquipe) => {
    const senha = window.prompt(`Nova senha para ${u.nome} (mínimo 6 caracteres):`);
    if (senha) void alterar(u, { senha }, `Senha de ${u.nome} trocada. As telas abertas com a senha antiga saem.`);
  };

  return (
    <main className="min-h-dvh p-4 space-y-4">
      <section className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <h1 className="font-display text-3xl">Equipe do restaurante</h1>
        <p className="text-sm text-muted-foreground">
          Usuários da tela da cozinha (<strong>/cozinha</strong>) e, em breve, do app do garçom.
        </p>
        <label className="block text-sm font-bold">
          Chave de administrador
          <input type="password" value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" className={campo} />
        </label>
        <label className="block text-sm font-bold">
          Id da loja (pv_stores.id)
          <input
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className={`${campo} font-mono text-sm`}
          />
        </label>
        <button
          onClick={() => void carregar()}
          disabled={ocupado || !chave || !storeId}
          className="h-12 px-5 rounded-xl bg-brand-red text-primary-foreground font-black disabled:opacity-40"
        >
          Abrir equipe
        </button>
      </section>

      {erro && (
        <p role="alert" className="text-destructive text-sm font-bold px-1">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="text-success text-sm font-bold px-1">
          {ok}
        </p>
      )}

      {lista && (
        <>
          <section className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="font-display text-2xl">Novo usuário · {lista.restaurante}</h2>
            <label className="block text-sm font-bold">
              Nome
              <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={campo} />
            </label>
            <label className="block text-sm font-bold">
              Login (letras, números, ponto ou hífen)
              <input
                value={novo.login}
                onChange={(e) => setNovo({ ...novo, login: e.target.value })}
                autoCapitalize="none"
                autoComplete="off"
                className={campo}
              />
            </label>
            <label className="block text-sm font-bold">
              Senha (mínimo 6)
              <input
                type="password"
                value={novo.senha}
                onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                autoComplete="new-password"
                className={campo}
              />
            </label>
            <fieldset className="text-sm font-bold">
              <legend>Acesso</legend>
              <div className="mt-1 flex gap-2">
                {(['cozinha', 'garcom'] as const).map((p) => (
                  <label
                    key={p}
                    className={`flex-1 h-11 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer ${
                      novo.papel === p ? 'border-brand-red bg-surface-soft' : 'border-border'
                    }`}
                  >
                    <input type="radio" name="papel" checked={novo.papel === p} onChange={() => setNovo({ ...novo, papel: p })} />
                    {ROTULO_DO_PAPEL[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              onClick={() => void criar()}
              disabled={ocupado || !novo.nome.trim() || !novo.login.trim() || novo.senha.length < 6}
              className="h-12 px-5 rounded-xl bg-brand-red text-primary-foreground font-black disabled:opacity-40"
            >
              Criar usuário
            </button>
          </section>

          <section className="space-y-2">
            {lista.usuarios.length === 0 && <p className="text-muted-foreground text-center py-6">Ninguém cadastrado ainda.</p>}
            {lista.usuarios.map((u) => (
              <article
                key={u.id}
                className={`bg-card rounded-2xl border border-border p-4 flex items-center gap-3 flex-wrap ${u.ativo ? '' : 'opacity-60'}`}
              >
                <div className="flex-1 min-w-40">
                  <p className="font-bold">{u.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {u.login} · {ROTULO_DO_PAPEL[u.papel]}
                    {u.ativo ? '' : ' · desativado'}
                  </p>
                </div>
                <button onClick={() => trocarSenha(u)} disabled={ocupado} className="h-10 px-3 rounded-xl bg-secondary text-sm font-bold">
                  Trocar senha
                </button>
                <button
                  onClick={() =>
                    void alterar(u, { ativo: !u.ativo }, u.ativo ? `${u.nome} desativado: não entra mais.` : `${u.nome} reativado.`)
                  }
                  disabled={ocupado}
                  className="h-10 px-3 rounded-xl bg-secondary text-sm font-bold"
                >
                  {u.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
