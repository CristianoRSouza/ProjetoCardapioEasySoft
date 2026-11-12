// PASSO 4 — Gera os segredos da API de um ambiente novo e mostra o .env pronto para preencher.
//
// Uso (na raiz do projeto, depois de `npm install` no backend):
//   node implantacao/4-gerar-segredos.mjs https://menu.exemplo.com.br https://api-menu.exemplo.com.br
//            └ endereço público do site ┘   └ endereço da API (opcional, só para o lembrete do BACKEND_URL) ┘
//
// Não grava arquivo nenhum: copie a saída para o cofre de segredos do ambiente (Infisical) ou para o
// backend/.env do servidor. Cada ambiente tem os SEUS segredos — não reaproveite os de outro:
//   * QR_TOKEN_SECRET assina os QR codes: trocar invalida todos os QR impressos daquele ambiente;
//   * o par VAPID identifica o servidor de push: trocar desinscreve os celulares dos garçons.
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const site = process.argv[2];
const api = process.argv[3];
if (!site || !/^https?:\/\//.test(site)) {
  console.error('Informe o endereço público do site. Ex.: node implantacao/4-gerar-segredos.mjs https://menu.exemplo.com.br');
  process.exit(1);
}

let webpush;
try {
  webpush = createRequire(path.join(import.meta.dirname, '..', 'backend', 'package.json'))('web-push');
} catch {
  console.error('Rode `npm install` no backend antes (o gerador usa a biblioteca web-push de lá).');
  process.exit(1);
}

const aleatorio = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const vapid = webpush.generateVAPIDKeys();
const origem = new URL(site).origin;

console.log(`# ---- backend/.env (API) — ambiente de ${origem} ----
PORT=3030
DATABASE_URL=postgresql://easymenu_api.<ref-do-projeto>:<senha do passo 3>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
QR_TOKEN_SECRET=${aleatorio(48)}
ADMIN_API_KEY=${aleatorio(32)}
PUBLIC_APP_URL=${origem}
CORS_ORIGINS=${origem}
# 1 atrás de um proxy (Caddy/Nginx/load balancer), para o limite de pedidos por IP valer por cliente
TRUST_PROXY=1
VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}
VAPID_SUBJECT=${origem.startsWith('https://') ? origem : 'mailto:suporte@exemplo.com.br'}

# ---- frontend (site) — variável de BUILD, não de execução ----
# BACKEND_URL=${api ?? '<endereço interno da API, ex.: http://easymenu-api:3030>'}
# docker build --build-arg BACKEND_URL=... (o Next grava no build; trocar depois exige novo build)`);
