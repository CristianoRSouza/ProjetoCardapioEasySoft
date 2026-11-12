import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next', 'node_modules', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Telas e componentes não fazem fetch direto: tudo passa por src/lib/api.ts.
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use src/lib/api.ts.' }],
    },
  },
  { files: ['src/lib/api.ts'], rules: { 'no-restricted-globals': 'off' } },
);
