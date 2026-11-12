export interface InscricaoPush {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NovaInscricao {
  usuarioId: string;
  storeId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Celulares de garçom inscritos para receber push (cardapio.inscricoes_push). */
export abstract class InscricoesPush {
  /** O endpoint é do aparelho: se outro garçom entrar no mesmo celular, a inscrição passa para ele. */
  abstract salvar(inscricao: NovaInscricao): Promise<void>;
  abstract remover(usuarioId: string, endpoint: string): Promise<void>;
  /** Só de garçons ATIVOS da loja. */
  abstract dosGarconsDaLoja(storeId: string): Promise<InscricaoPush[]>;
  abstract apagar(ids: string[]): Promise<void>;
}

export interface MensagemDePush {
  titulo: string;
  corpo: string;
  /** Avisos com a mesma tag se substituem na central de notificações do celular. */
  tag: string;
  url: string;
}

/** `expirada`: o serviço de push diz que o aparelho não existe mais (desinstalou, revogou). */
export type ResultadoDoPush = 'entregue' | 'expirada' | 'falhou';

export abstract class EnviadorDePush {
  /** Chave pública VAPID que o celular usa para se inscrever; null = push desligado. */
  abstract readonly chavePublica: string | null;
  abstract enviar(inscricao: InscricaoPush, mensagem: MensagemDePush): Promise<ResultadoDoPush>;
}
