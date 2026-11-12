import { Injectable, Logger } from '@nestjs/common';
import webpush, { WebPushError } from 'web-push';
import { Config } from '../../../config/config.module';
import { EnviadorDePush, type InscricaoPush, type MensagemDePush, type ResultadoDoPush } from '../application/portas';

/** Web Push (VAPID) pela biblioteca `web-push`: criptografa a mensagem para o aparelho e entrega. */
@Injectable()
export class EnviadorWebPush extends EnviadorDePush {
  private readonly log = new Logger('Push');
  override readonly chavePublica: string | null;
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(config: Config) {
    super();
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = config.valores;
    this.vapid = VAPID_PUBLIC_KEY ? { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } : null;
    this.chavePublica = this.vapid?.publicKey ?? null;
  }

  override async enviar(inscricao: InscricaoPush, mensagem: MensagemDePush): Promise<ResultadoDoPush> {
    if (!this.vapid) return 'falhou';
    try {
      await webpush.sendNotification(
        { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
        JSON.stringify(mensagem),
        // Aviso de prato pronto vale pouco depois de 10 min: o serviço de push descarta.
        { vapidDetails: this.vapid, TTL: 600, urgency: 'high', timeout: 10_000 },
      );
      return 'entregue';
    } catch (e) {
      if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) return 'expirada';
      // O endpoint identifica o aparelho: no log vai só o servidor de push.
      const servidor = URL.canParse(inscricao.endpoint) ? new URL(inscricao.endpoint).host : '?';
      this.log.warn(`push falhou (${servidor}): ${e instanceof WebPushError ? `HTTP ${e.statusCode}` : (e as Error).message}`);
      return 'falhou';
    }
  }
}
