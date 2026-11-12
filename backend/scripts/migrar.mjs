// Aplica database/migrations/*.sql em ordem. Todas são idempotentes (IF NOT EXISTS),
// então rodar de novo não muda nada. Uso: node --env-file=.env scripts/migrar.mjs
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const pasta = path.join(import.meta.dirname, '..', 'database', 'migrations');
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();

const cliente = new pg.Client({
  connectionString: url,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
});
await cliente.connect();
try {
  const { rows } = await cliente.query('select current_database() as banco, current_user as usuario');
  console.log(`banco=${rows[0].banco} usuario=${rows[0].usuario}`);
  for (const arquivo of arquivos) {
    await cliente.query(fs.readFileSync(path.join(pasta, arquivo), 'utf8'));
    console.log(`aplicada: ${arquivo}`);
  }
} finally {
  await cliente.end();
}
