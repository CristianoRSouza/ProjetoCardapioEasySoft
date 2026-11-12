'use client';

import { useState } from 'react';
import { Logo } from '@/components/cabecalho';
import { api, ErroDaApi, type Papel } from '@/lib/api';
import { useSessaoDaEquipe } from '@/lib/sessao-da-equipe';

const TELA: Record<Papel, { titulo: string; subtitulo: string; outro: string }> = {
  cozinha: { titulo: 'Cozinha', subtitulo: 'Entre com o usuário da cozinha', outro: 'Este usuário não é da cozinha.' },
  garcom: { titulo: 'Garçom', subtitulo: 'Entre com o seu usuário de garçom', outro: 'Este usuário não é de garçom.' },
};

/** Login da cozinha e do garçom. Usuário e senha são cadastrados em /admin/equipe. */
export function EntrarDaEquipe({ papel, aviso }: { papel: Papel; aviso?: string | null }) {
  const entrar = useSessaoDaEquipe((s) => s.entrar);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tela = TELA[papel];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.entrar(login.trim(), senha);
      if (r.usuario.papel !== papel) {
        setErro(tela.outro);
        return;
      }
      entrar({ token: r.token, nome: r.usuario.nome, papel: r.usuario.papel, restaurante: r.restaurante });
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground p-4">
      <form onSubmit={(e) => void enviar(e)} className="w-full max-w-sm bg-card rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Logo tamanho="lg" />
          <div>
            <h1 className="font-display text-3xl leading-none">
              <span className="text-brand-red">Easy</span>Menu · {tela.titulo}
            </h1>
            <p className="text-sm text-muted-foreground">{tela.subtitulo}</p>
          </div>
        </div>
        {aviso && <p className="text-sm bg-surface-soft rounded-xl p-3">{aviso}</p>}
        <label className="block text-sm font-bold">
          Usuário
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            className="mt-1 w-full h-12 px-3 rounded-xl border-2 border-border bg-background text-base"
          />
        </label>
        <label className="block text-sm font-bold">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full h-12 px-3 rounded-xl border-2 border-border bg-background text-base"
          />
        </label>
        {erro && (
          <p role="alert" className="text-destructive text-sm font-bold">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando || !login.trim() || !senha}
          className="w-full h-14 rounded-xl bg-brand-red text-primary-foreground font-black uppercase tracking-wider disabled:opacity-40"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
