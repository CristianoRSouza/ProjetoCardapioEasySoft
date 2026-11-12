import { describe, expect, it } from 'vitest';
import { gerarToken, lerToken, normalizarMesa } from '../src/modules/mesa/domain/token-da-mesa';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const LOJA = 'ad5c0141-f6e4-47a3-9313-b103260bb9a0';

describe('token da mesa', () => {
  it('ida e volta preserva loja e mesa normalizada', () => {
    const token = gerarToken({ storeId: LOJA, mesa: '05' }, SEGREDO);
    expect(lerToken(token, SEGREDO)).toEqual({ storeId: LOJA, mesa: '5' });
  });

  it('recusa token assinado com outro segredo', () => {
    const token = gerarToken({ storeId: LOJA, mesa: '1' }, SEGREDO);
    expect(lerToken(token, 'outro-segredo-com-mais-de-32-caracteres!!')).toBeNull();
  });

  it('trocar a mesa no link invalida a assinatura', () => {
    const [, assinatura] = gerarToken({ storeId: LOJA, mesa: '1' }, SEGREDO).split('.');
    const adulterado = `${Buffer.from(`${LOJA}:2`).toString('base64url')}.${assinatura}`;
    expect(lerToken(adulterado, SEGREDO)).toBeNull();
  });

  it.each(['', 'abc', 'a.b.c', 'x'.repeat(300), `${Buffer.from('nao-uuid:1').toString('base64url')}.zzz`])(
    'recusa lixo: %s',
    (token) => expect(lerToken(token, SEGREDO)).toBeNull(),
  );

  it('normaliza mesa como o protótipo', () => {
    expect(normalizarMesa(' 007 ')).toBe('7');
    expect(normalizarMesa('a1')).toBe('A1');
    expect(normalizarMesa('0')).toBe('0');
    expect(normalizarMesa('mesa 1')).toBeNull();
    expect(normalizarMesa('12345678901')).toBeNull();
  });

  it('não gera token para loja que não é uuid', () => {
    expect(() => gerarToken({ storeId: 'loja', mesa: '1' }, SEGREDO)).toThrow();
  });
});
