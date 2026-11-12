'use client';

/**
 * Push do app do garçom: avisa "pedido pronto" com o celular bloqueado ou o app fechado.
 *
 * Android (Chrome) recebe direto pelo navegador. No iPhone, a Apple só entrega push para o app
 * INSTALADO na Tela de Início (iOS 16.4+): pelo Safari aberto não há como pedir a permissão.
 */
import { api } from './api';

export type EstadoDoPush =
  | 'sem_suporte' // navegador sem Web Push
  | 'instalar_primeiro' // iPhone pelo Safari: precisa "Adicionar à Tela de Início"
  | 'desligado' // o restaurante não configurou as chaves (a API não tem VAPID)
  | 'negado' // o garçom bloqueou as notificações no navegador
  | 'inativo'
  | 'ativo';

const SW = '/sw-garcom.js';
const ESCOPO = '/garcom';

const ehIphoneNoSafari = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !(navigator as Navigator & { standalone?: boolean }).standalone &&
  !matchMedia('(display-mode: standalone)').matches;

function suporta() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function inscricaoAtual() {
  const registro = await navigator.serviceWorker.getRegistration(ESCOPO);
  return (await registro?.pushManager.getSubscription()) ?? null;
}

/** A chave pública vem em base64url; o navegador quer os bytes. */
function bytesDaChave(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function estadoDoPush(token: string): Promise<EstadoDoPush> {
  if (!suporta()) return ehIphoneNoSafari() ? 'instalar_primeiro' : 'sem_suporte';
  const { chavePublica } = await api.chaveDoPush(token);
  if (!chavePublica) return 'desligado';
  if (Notification.permission === 'denied') return 'negado';
  const atual = await inscricaoAtual();
  if (!atual) return 'inativo';
  // Garante que a API conhece este aparelho com o garçom desta sessão (pode ter trocado o login).
  await api.inscreverPush(token, atual.toJSON());
  return 'ativo';
}

/** Precisa ser chamado num toque do garçom: o navegador só pede a permissão assim. */
export async function ativarPush(token: string): Promise<EstadoDoPush> {
  if (!suporta()) return ehIphoneNoSafari() ? 'instalar_primeiro' : 'sem_suporte';
  const { chavePublica } = await api.chaveDoPush(token);
  if (!chavePublica) return 'desligado';
  if ((await Notification.requestPermission()) !== 'granted') return 'negado';

  const registro = await navigator.serviceWorker.register(SW, { scope: ESCOPO });
  await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  // Inscrição feita com outra chave (o restaurante trocou as chaves VAPID) não recebe mais nada.
  const chave = bytesDaChave(chavePublica);
  const outraChave = inscricao?.options.applicationServerKey && !mesmosBytes(new Uint8Array(inscricao.options.applicationServerKey), chave);
  if (inscricao && outraChave) {
    await inscricao.unsubscribe();
    inscricao = null;
  }
  inscricao ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  await api.inscreverPush(token, inscricao.toJSON());
  return 'ativo';
}

/** Ao sair do app: este celular deixa de receber os avisos deste garçom. */
export async function desativarPush(token: string) {
  if (!suporta()) return;
  const atual = await inscricaoAtual();
  if (!atual) return;
  await api.removerPush(token, atual.endpoint).catch(() => undefined);
  await atual.unsubscribe();
}

function mesmosBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
