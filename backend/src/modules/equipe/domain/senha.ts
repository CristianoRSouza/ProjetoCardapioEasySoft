import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Senha da equipe guardada só como hash scrypt (nativo do Node, sem dependência).
 * Formato: scrypt$N$r$p$<sal base64url>$<hash base64url> — os parâmetros vão junto para poderem
 * subir no futuro sem invalidar as senhas já cadastradas.
 */

const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 32;

function derivar(senha: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, falha) =>
    scrypt(senha.normalize('NFKC'), sal, TAMANHO, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, chave) =>
      e ? falha(e) : ok(chave),
    ),
  );
}

export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal, N, R, P);
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, hash, ...resto] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash || resto.length) return false;
  const [nn, rr, pp] = [Number(n), Number(r), Number(p)];
  if (![nn, rr, pp].every((v) => Number.isInteger(v) && v > 0) || nn > 2 ** 20) return false;

  const esperado = Buffer.from(hash, 'base64url');
  if (esperado.length !== TAMANHO) return false;
  try {
    return timingSafeEqual(await derivar(senha, Buffer.from(sal, 'base64url'), nn, rr, pp), esperado);
  } catch {
    return false;
  }
}

/** Hash de uma senha que ninguém tem: o login de usuário inexistente gasta o mesmo tempo. */
export const HASH_DE_ENGANO = gerarHashDeSenha(randomBytes(18).toString('base64url'));
