import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * O QR code colado na mesa leva um token assinado com a loja e a mesa. Assim o cliente não digita
 * a mesa (não erra) e não consegue trocar o número no link para pedir em nome de outra mesa.
 *
 * Formato: base64url("<storeId>:<mesa>") + "." + base64url(HMAC-SHA256)[0..22]
 */

export interface Mesa {
  storeId: string;
  mesa: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "05" → "5", " a1 " → "A1". Mesmo critério do protótipo. Devolve null se não for uma mesa válida. */
export function normalizarMesa(bruto: string): string | null {
  const v = bruto.trim().replace(/^0+(?=\d)/, '');
  if (!/^[A-Za-z0-9-]{1,10}$/.test(v)) return null;
  return v.toUpperCase();
}

function assinatura(conteudo: string, segredo: string) {
  return createHmac('sha256', segredo).update(conteudo).digest('base64url').slice(0, 22);
}

export function gerarToken({ storeId, mesa }: Mesa, segredo: string): string {
  const mesaNormalizada = normalizarMesa(mesa);
  if (!UUID.test(storeId) || !mesaNormalizada) throw new Error('Loja ou mesa inválida para o QR code.');
  const conteudo = Buffer.from(`${storeId.toLowerCase()}:${mesaNormalizada}`).toString('base64url');
  return `${conteudo}.${assinatura(conteudo, segredo)}`;
}

/** Devolve a mesa se o token for autêntico; null para qualquer coisa adulterada ou malformada. */
export function lerToken(token: string, segredo: string): Mesa | null {
  if (typeof token !== 'string' || token.length > 200) return null;
  const [conteudo, assinado, ...resto] = token.split('.');
  if (!conteudo || !assinado || resto.length) return null;

  const esperado = Buffer.from(assinatura(conteudo, segredo));
  const recebido = Buffer.from(assinado);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;

  const [storeId, mesa] = Buffer.from(conteudo, 'base64url').toString('utf8').split(':');
  if (!storeId || !mesa || !UUID.test(storeId) || normalizarMesa(mesa) !== mesa) return null;
  return { storeId, mesa };
}
