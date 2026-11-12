import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Fronteiras entre camadas. No flat config o último bloco que casa vence a regra inteira,
// então cada bloco repete a restrição do `pg`.
const semPg = { name: 'pg', message: 'Banco só em src/infra/db (DbService).' };

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { paths: [semPg] }],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Ambiente só em src/config (lerAmbiente).' },
      ],
    },
  },
  { files: ['src/config/**', 'test/**'], rules: { 'no-restricted-properties': 'off' } },
  { files: ['src/infra/db/**'], rules: { 'no-restricted-imports': 'off' } },
  {
    files: ['src/modules/*/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [semPg, { name: '@nestjs/common', message: 'Domínio não depende de framework.' }],
          patterns: [{ group: ['**/infrastructure/**', '**/http/**', '**/infra/**'], message: 'Domínio é puro.' }],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/application/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [semPg],
          patterns: [{ group: ['**/infrastructure/**', '**/http/**', '**/infra/**'], message: 'Aplicação depende só de portas.' }],
        },
      ],
    },
  },
);
