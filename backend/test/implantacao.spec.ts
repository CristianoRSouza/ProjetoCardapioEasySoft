// A pasta implantacao/ não pode ficar para trás das migrações: o passo 2 é gerado delas, e toda
// tabela do schema cardapio precisa de permissão (passo 3) e de conferência (passo 6).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = path.join(__dirname, '..', '..');
const ler = (arquivo: string) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').replace(/\r\n/g, '\n');
const migracoes = fs
  .readdirSync(path.join(RAIZ, 'backend', 'database', 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ler(`backend/database/migrations/${f}`))
  .join('\n');
const tabelasDoCardapio = [...migracoes.matchAll(/CREATE TABLE IF NOT EXISTS cardapio\.(\w+)/g)].map((m) => m[1]!);

describe('pasta implantacao/', () => {
  it('o passo 2 é exatamente as migrações juntas (rode `npm run implantacao:gerar`)', async () => {
    const gerador = pathToFileURL(path.join(RAIZ, 'backend', 'scripts', 'juntar-migracoes.mjs')).href;
    const { juntarMigracoes } = (await import(gerador)) as { juntarMigracoes: () => string };
    expect(ler('implantacao/2-tabelas-do-cardapio.sql')).toBe(juntarMigracoes());
  });

  it('as migrações criam as quatro tabelas conhecidas', () => {
    expect(tabelasDoCardapio.sort()).toEqual(['alteracoes', 'envios', 'inscricoes_push', 'usuarios']);
  });

  it.each(tabelasDoCardapio)('cardapio.%s tem GRANT e policy no passo 3 e conferência no passo 6', (t) => {
    const passo3 = ler('implantacao/3-usuario-da-api.sql');
    expect(passo3).toMatch(new RegExp(`GRANT [A-Z, ]+ ON cardapio\\.${t} TO easymenu_api`));
    expect(passo3).toContain(`DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.${t};`);
    expect(passo3).toMatch(new RegExp(`CREATE POLICY easymenu_api_rw ON cardapio\\.${t}\\s`));
    const passo6 = ler('implantacao/6-conferir-ambiente.sql');
    expect(passo6).toContain(`('${t}')`);
    expect(passo6).toContain(`('cardapio.${t}', 'easymenu_api_rw')`);
  });

  it('o passo 3 se recusa a criar o usuário com a senha de exemplo', () => {
    const passo3 = ler('implantacao/3-usuario-da-api.sql');
    expect(passo3).toContain("senha constant text := 'TROQUE-ESTA-SENHA';");
    expect(passo3).toMatch(/IF NOT existe THEN\s+RAISE EXCEPTION/);
  });
});
