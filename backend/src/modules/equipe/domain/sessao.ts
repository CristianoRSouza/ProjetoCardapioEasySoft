import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sessão da equipe (cozinha, garçom): token assinado, sem tabela de sessões.
 * Formato: base64url(JSON) + "." + base64url(HMAC-SHA256)
 *
 * A chave é DERIVADA do QR_TOKEN_SECRET com um rótulo próprio. Assim não há mais um segredo para
 * configurar, e um token de mesa nunca vale como sessão (e vice-versa).
 *
 * Desativar o usuário ou trocar a senha derruba as sessões abertas: o guard confere a `versao`
 * contra `cardapio.usuarios.sessao_versao` a cada requisição.
 */

export type Papel = 'cozinha' | 'garcom';

export interface Sessao {
  usuarioId: string;
  storeId: string;
  papel: Papel;
  versao: number;
}

/** Um turno longo. Passou disso, entra de novo. */
export const DURACAO_DA_SESSAO_MS = 14 * 3600_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const chave = (segredo: string) => createHmac('sha256', segredo).update('easymenu:sessao-da-equipe:v1').digest();
const assinar = (conteudo: string, segredo: string) =>
  createHmac('sha256', chave(segredo)).update(conteudo).digest('base64url');

export function gerarSessao(s: Sessao, segredo: string, agora = Date.now()): string {
  const conteudo = Buffer.from(
    JSON.stringify({ u: s.usuarioId, s: s.storeId, p: s.papel, v: s.versao, exp: agora + DURACAO_DA_SESSAO_MS }),
  ).toString('base64url');
  return `${conteudo}.${assinar(conteudo, segredo)}`;
}

export function lerSessao(token: string, segredo: string, agora = Date.now()): Sessao | null {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [conteudo, assinado, ...resto] = token.split('.');
  if (!conteudo || !assinado || resto.length) return null;

  const esperado = Buffer.from(assinar(conteudo, segredo));
  const recebido = Buffer.from(assinado);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;

  let dados: { u?: unknown; s?: unknown; p?: unknown; v?: unknown; exp?: unknown };
  try {
    dados = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const { u, s, p, v, exp } = dados;
  if (typeof u !== 'string' || !UUID.test(u) || typeof s !== 'string' || !UUID.test(s)) return null;
  if ((p !== 'cozinha' && p !== 'garcom') || !Number.isInteger(v) || typeof exp !== 'number' || exp <= agora) return null;
  return { usuarioId: u, storeId: s, papel: p, versao: v as number };
}
