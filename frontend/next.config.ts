import type { NextConfig } from 'next';

// O navegador fala só com o próprio site: /api/v1/* é repassado à API NestJS pelo servidor do Next.
// Assim não há CORS nem endereço da API exposto no bundle.
const API = process.env.BACKEND_URL ?? 'http://localhost:3030';

const seguranca = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/v1/:caminho*', destination: `${API}/api/v1/:caminho*` }];
  },
  async headers() {
    return [
      { source: '/:caminho*', headers: seguranca },
      // O navegador confere o service worker a cada abertura: versão nova entra sem esperar cache.
      { source: '/sw-garcom.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default config;
