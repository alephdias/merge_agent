import { Pool } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (err: Error) => {
  logger.error({ err }, 'Erro inesperado no pool do PostgreSQL');
  process.exit(1);
});

export async function checkDbConnection(): Promise<void> {
  const client = await db.connect();
  client.release();
  logger.info('PostgreSQL conectado com sucesso');
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<import('pg').QueryResult<T>> {
  return db.query<T>(text, params);
}
