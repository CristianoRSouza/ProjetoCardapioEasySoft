// O service worker do garçom (public/sw-garcom.js) rodando num `self` falso: o push vira aviso
// na tela do celular e o toque no aviso abre (ou foca) o app.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Ouvinte = (evento: Record<string, unknown>) => void;

function carregar(janelas: { url: string; focus: () => Promise<unknown>; navigate?: (u: string) => Promise<unknown> }[] = []) {
  const ouvintes: Record<string, Ouvinte> = {};
  const self = {
    location: { origin: 'https://menu.exemplo.com' },
    addEventListener: (tipo: string, fn: Ouvinte) => (ouvintes[tipo] = fn),
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => janelas), openWindow: vi.fn(async () => undefined) },
  };
  runInNewContext(readFileSync('public/sw-garcom.js', 'utf8'), { self, URL });
  const disparar = async (tipo: string, extra: Record<string, unknown>) => {
    let espera: Promise<unknown> = Promise.resolve();
    ouvintes[tipo]!({ ...extra, waitUntil: (p: Promise<unknown>) => (espera = p) });
    await espera;
  };
  return { self, disparar };
}

describe('service worker do garçom', () => {
  it('push vira aviso com título, texto, vibração e o endereço do app', async () => {
    const { self, disparar } = carregar();
    const mensagem = { titulo: 'Mesa 5 — pedido pronto', corpo: '#104 · Carla. Pode levar à mesa.', tag: 'pronto-1', url: '/garcom' };
    await disparar('push', { data: { json: () => mensagem } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Mesa 5 — pedido pronto',
      expect.objectContaining({ body: mensagem.corpo, tag: 'pronto-1', renotify: true, requireInteraction: true, data: { url: '/garcom' } }),
    );
  });

  it('push sem JSON ainda avisa, com o texto padrão', async () => {
    const { self, disparar } = carregar();
    await disparar('push', { data: { json: () => JSON.parse('não é json') } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('EasyMenu', expect.objectContaining({ body: 'Há um pedido pronto para levar.' }));
  });

  it('tocar no aviso foca o app aberto; sem app aberto, abre um', async () => {
    const focus = vi.fn(async () => ({ navigate: vi.fn() }));
    const aberto = carregar([{ url: 'https://menu.exemplo.com/garcom/mesa/5', focus }]);
    const fechar = vi.fn();
    await aberto.disparar('notificationclick', { notification: { close: fechar, data: { url: '/garcom' } } });
    expect(fechar).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(aberto.self.clients.openWindow).not.toHaveBeenCalled();

    const fechado = carregar([{ url: 'https://menu.exemplo.com/mesa/abc', focus: vi.fn() }]);
    await fechado.disparar('notificationclick', { notification: { close: vi.fn(), data: { url: '/garcom' } } });
    expect(fechado.self.clients.openWindow).toHaveBeenCalledWith('https://menu.exemplo.com/garcom');
  });
});
