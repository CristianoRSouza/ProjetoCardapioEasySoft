import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O SWC preserva os metadados de decorator que o DI do Nest precisa (o esbuild padrão não emite).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
  },
});
