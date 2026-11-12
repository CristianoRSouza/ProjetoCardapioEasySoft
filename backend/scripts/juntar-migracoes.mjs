// Gera implantacao/2-tabelas-do-cardapio.sql juntando database/migrations/*.sql em ordem, para
// quem aplica pelo SQL Editor do Supabase colar um arquivo só. A fonte continua sendo as migrações:
// mudou uma, rode `npm run implantacao:gerar` (o teste test/implantacao.spec.ts acusa se esquecer).
import fs from 'node:fs';
import path from 'node:path';

export const PASTA_MIGRACOES = path.join(import.meta.dirname, '..', 'database', 'migrations');
export const DESTINO = path.join(import.meta.dirname, '..', '..', 'implantacao', '2-tabelas-do-cardapio.sql');

export function juntarMigracoes() {
  const arquivos = fs.readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql')).sort();
  const partes = arquivos.map((f) => {
    const sql = fs.readFileSync(path.join(PASTA_MIGRACOES, f), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    return `-- ${'='.repeat(90)}\n-- backend/database/migrations/${f}\n-- ${'='.repeat(90)}\n\n${sql}\n`;
  });
  return [
    '-- PASSO 2 — Tabelas do cardápio (schema `cardapio`). GERADO: não edite à mão.',
    '--',
    '-- Junta backend/database/migrations/*.sql em ordem (`npm run implantacao:gerar` no backend).',
    '-- Rode no SQL Editor do Supabase do ambiente, como postgres. Idempotente: rodar de novo não muda',
    '-- nada. Alternativa pela linha de comando: `npm run db:migrar` no backend, com o DATABASE_URL do',
    '-- usuário postgres (não o da API).',
    '',
    ...partes,
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  fs.writeFileSync(DESTINO, juntarMigracoes());
  console.log(`gerado: ${path.relative(process.cwd(), DESTINO)}`);
}
