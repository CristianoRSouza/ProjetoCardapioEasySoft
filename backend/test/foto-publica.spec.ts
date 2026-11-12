import { describe, expect, it } from 'vitest';
import { fotoPublica } from '../src/modules/cardapio/infrastructure/catalogo-pg';

describe('fotoPublica', () => {
  it('mantém foto pública do Storage do Supabase', () => {
    const url = 'https://ltixkslqlreybdhutpbr.supabase.co/storage/v1/object/public/product-images/x.jpg';
    expect(fotoPublica(url)).toBe(url);
  });

  it.each([
    'http://127.0.0.1:3001/images/53.jpg',
    'https://localhost/a.jpg',
    'https://192.168.0.10/a.jpg',
    'https://10.0.0.5/a.jpg',
    'https://172.20.1.1/a.jpg',
    'https://servidor-da-loja/a.jpg',
    'http://cdn.exemplo.com/a.jpg',
    'C:\\fotos\\a.jpg',
    '',
    null,
  ])('descarta foto inalcançável do celular: %s', (url) => {
    expect(fotoPublica(url)).toBeNull();
  });
});
