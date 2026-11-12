import { z } from 'zod';

const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3030),
  DATABASE_URL: z.string().url(),
  // false só para Postgres local de desenvolvimento/teste; o Supabase exige SSL.
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  QR_TOKEN_SECRET: z.string().min(32, 'QR_TOKEN_SECRET precisa de pelo menos 32 caracteres'),
  ADMIN_API_KEY: z.string().min(24, 'ADMIN_API_KEY precisa de pelo menos 24 caracteres'),
  PUBLIC_APP_URL: z.string().url(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Web Push do app do garçom (aviso de pedido pronto com o celular bloqueado). Opcional: sem as
  // chaves, o garçom é avisado só com o app aberto. Gerar com `npx web-push generate-vapid-keys`.
  VAPID_PUBLIC_KEY: z.string().trim().default(''),
  VAPID_PRIVATE_KEY: z.string().trim().default(''),
  // Contato exigido pelos serviços de push: https://… ou mailto:…
  VAPID_SUBJECT: z.string().trim().default(''),
}).superRefine((v, ctx) => {
  const preenchidas = [v.VAPID_PUBLIC_KEY, v.VAPID_PRIVATE_KEY, v.VAPID_SUBJECT].filter(Boolean).length;
  if (preenchidas !== 0 && preenchidas !== 3) {
    ctx.addIssue({ code: 'custom', path: ['VAPID_*'], message: 'informe as três (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT) ou nenhuma' });
  }
  if (v.VAPID_SUBJECT && !/^(https:\/\/|mailto:)/.test(v.VAPID_SUBJECT)) {
    ctx.addIssue({ code: 'custom', path: ['VAPID_SUBJECT'], message: 'deve começar com https:// ou mailto:' });
  }
});

export type Ambiente = z.infer<typeof esquema>;

/** Valida o ambiente uma vez. Falta de variável derruba o boot com a lista do que falta. */
export function lerAmbiente(fonte: NodeJS.ProcessEnv = process.env): Ambiente {
  const r = esquema.safeParse(fonte);
  if (!r.success) {
    const problemas = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${problemas}`);
  }
  return r.data;
}
