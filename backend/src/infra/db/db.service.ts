import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { Config } from '../../config/config.module';

export type Executor = Pick<pg.PoolClient, 'query'>;

/** O Postgres recusou por chave única repetida (23505). */
export const violouUnicidade = (e: unknown) => e instanceof pg.DatabaseError && e.code === '23505';

/**
 * Único ponto do sistema que fala com o Postgres. O resto recebe um `Executor` e não sabe se
 * está dentro de transação ou não.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly log = new Logger('Db');
  private readonly pool: pg.Pool;

  constructor(config: Config) {
    const { DATABASE_URL, DATABASE_SSL, DATABASE_SSL_REJECT_UNAUTHORIZED } = config.valores;
    this.pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_SSL ? { rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.pool.on('error', (e) => this.log.error(`conexão ociosa caiu: ${e.message}`));
  }

  query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.pool.query<T>(sql, params);
  }

  /** Executa `trabalho` numa transação; qualquer exceção desfaz tudo. */
  async transacao<T>(trabalho: (tx: Executor) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await trabalho(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
