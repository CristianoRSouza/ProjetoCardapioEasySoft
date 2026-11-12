import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { conferirSenha, gerarHashDeSenha } from '../src/modules/equipe/domain/senha';
import { gerarSessao, lerSessao, type Sessao } from '../src/modules/equipe/domain/sessao';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const SESSAO: Sessao = {
  usuarioId: '0e8f5d1c-2b7a-4c11-9a1e-6f2d3c4b5a69',
  storeId: 'ad5c0141-f6e4-47a3-9313-b103260bb9a0',
  papel: 'cozinha',
  versao: 1,
};

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await gerarHashDeSenha('cozinha123');
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain('cozinha123');
    expect(await conferirSenha('cozinha123', hash)).toBe(true);
    expect(await conferirSenha('Cozinha123', hash)).toBe(false);
  });

  it('a mesma senha gera hashes diferentes (sal aleatório)', async () => {
    expect(await gerarHashDeSenha('abc12345')).not.toBe(await gerarHashDeSenha('abc12345'));
  });

  it('hash malformado nunca confere', async () => {
    for (const lixo of ['', 'scrypt$', 'md5$x$y', 'scrypt$16384$8$1$zz$zz']) {
      expect(await conferirSenha('qualquer', lixo)).toBe(false);
    }
  });
});

describe('sessão da equipe', () => {
  const agora = Date.UTC(2026, 10, 9, 20, 0);

  it('token válido devolve a sessão', () => {
    const token = gerarSessao(SESSAO, SEGREDO, agora);
    expect(lerSessao(token, SEGREDO, agora + 60_000)).toEqual(SESSAO);
  });

  it('expira depois de 14 horas', () => {
    const token = gerarSessao(SESSAO, SEGREDO, agora);
    expect(lerSessao(token, SEGREDO, agora + 13.9 * 3600_000)).not.toBeNull();
    expect(lerSessao(token, SEGREDO, agora + 14.1 * 3600_000)).toBeNull();
  });

  it('token adulterado, de outro segredo ou malformado não vale', () => {
    const token = gerarSessao(SESSAO, SEGREDO, agora);
    const [conteudo, assinatura] = token.split('.');
    const trocado = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(conteudo!, 'base64url').toString()), p: 'garcom' }),
    ).toString('base64url');
    expect(lerSessao(`${trocado}.${assinatura}`, SEGREDO, agora)).toBeNull();
    expect(lerSessao(gerarSessao(SESSAO, `${SEGREDO}-outro`, agora), SEGREDO, agora)).toBeNull();
    for (const lixo of ['', 'a.b', 'a.b.c', `${token}x`]) expect(lerSessao(lixo, SEGREDO, agora)).toBeNull();
  });

  it('conteúdo assinado com o segredo cru (como o QR da mesa) não vale como sessão', () => {
    const conteudo = gerarSessao(SESSAO, SEGREDO, agora).split('.')[0]!;
    const comSegredoCru = createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
    expect(lerSessao(`${conteudo}.${comSegredoCru}`, SEGREDO, agora)).toBeNull();
  });
});
