// Web Push de verdade: a mensagem sai criptografada para a chave do celular (aes128gcm) e assinada
// com a chave VAPID do servidor. O teste faz o papel do celular e decifra.
import { createECDH, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import webpush, { WebPushError } from 'web-push';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config/config.module';
import { lerAmbiente } from '../src/config/env';
import { EnviadorWebPush } from '../src/modules/avisos/infrastructure/enviador-web-push';

// http_ece é o que a própria web-push usa para criptografar; aqui decifra.
const ece = createRequire(`${process.cwd()}/package.json`)('http_ece') as {
  decrypt: (corpo: Buffer, p: { version: string; privateKey: ReturnType<typeof createECDH>; authSecret: Buffer }) => Buffer;
};

const vapid = webpush.generateVAPIDKeys();
const base = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/teste',
  QR_TOKEN_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
  ADMIN_API_KEY: 'chave-de-admin-de-teste-123456',
  PUBLIC_APP_URL: 'https://menu.exemplo.com/',
};
const config = (extra: Record<string, string>): Config => ({ valores: lerAmbiente({ ...base, ...extra }) });
const comPush = config({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'https://easysoftcloud.com.br' });

function celular() {
  const chave = createECDH('prime256v1');
  chave.generateKeys();
  const auth = randomBytes(16);
  return {
    chave,
    auth,
    inscricao: { id: 'x', endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: chave.getPublicKey('base64url'), auth: auth.toString('base64url') },
  };
}
const mensagem = { titulo: 'Mesa 5 — pedido pronto', corpo: '#104 · Carla. Pode levar à mesa.', tag: 'pronto-1', url: '/garcom' };

afterEach(() => vi.restoreAllMocks());

describe('Web Push', () => {
  it('só o celular inscrito abre a mensagem, e ela vai assinada com a chave VAPID', () => {
    const { chave, auth, inscricao } = celular();
    const pedido = webpush.generateRequestDetails(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify(mensagem),
      { vapidDetails: { subject: 'https://easysoftcloud.com.br', publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 600 },
    );
    expect(pedido.headers['Content-Encoding']).toBe('aes128gcm');
    expect(String(pedido.headers.Authorization)).toContain(`k=${vapid.publicKey}`);
    expect(pedido.body!.toString('utf8')).not.toContain('Mesa 5');

    const aberto = ece.decrypt(pedido.body as Buffer, { version: 'aes128gcm', privateKey: chave, authSecret: auth });
    expect(JSON.parse(aberto.toString('utf8'))).toEqual(mensagem);

    const outro = celular();
    expect(() => ece.decrypt(pedido.body as Buffer, { version: 'aes128gcm', privateKey: outro.chave, authSecret: outro.auth })).toThrow();
  });

  it('entrega com validade de 10 min e urgência alta; 404/410 = celular que não existe mais', async () => {
    const enviar = vi.spyOn(webpush, 'sendNotification');
    const enviador = new EnviadorWebPush(comPush);
    const { inscricao } = celular();

    enviar.mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });
    expect(await enviador.enviar(inscricao, mensagem)).toBe('entregue');
    expect(enviar.mock.calls[0]![2]).toMatchObject({ TTL: 600, urgency: 'high' });
    expect(JSON.parse(enviar.mock.calls[0]![1] as string)).toEqual(mensagem);

    enviar.mockRejectedValueOnce(new WebPushError('gone', 410, {}, '', inscricao.endpoint));
    expect(await enviador.enviar(inscricao, mensagem)).toBe('expirada');
    enviar.mockRejectedValueOnce(new WebPushError('erro', 500, {}, '', inscricao.endpoint));
    expect(await enviador.enviar(inscricao, mensagem)).toBe('falhou');
    enviar.mockRejectedValueOnce(new Error('timeout'));
    expect(await enviador.enviar(inscricao, mensagem)).toBe('falhou');
  });

  it('sem chaves configuradas o push fica desligado', () => {
    expect(new EnviadorWebPush(config({})).chavePublica).toBeNull();
    expect(new EnviadorWebPush(comPush).chavePublica).toBe(vapid.publicKey);
  });

  it('configuração pela metade ou contato inválido derruba o boot', () => {
    expect(() => config({ VAPID_PUBLIC_KEY: vapid.publicKey })).toThrow(/VAPID/);
    expect(() =>
      config({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'http://loja.com' }),
    ).toThrow(/https:\/\/ ou mailto:/);
  });
});
