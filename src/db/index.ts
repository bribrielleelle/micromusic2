import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _sonaPostgresPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return false;
  if (raw.includes('user:password@localhost')) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString || !isDatabaseConfigured()) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  if (!global._sonaPostgresPool) {
    const useSsl =
      process.env.DATABASE_SSL === 'true' ||
      (!connectionString.includes('localhost') &&
        !connectionString.includes('127.0.0.1') &&
        !connectionString.includes('sslmode=disable'));

    global._sonaPostgresPool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 4000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

    global._sonaPostgresPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }

  return global._sonaPostgresPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return drizzle(getPool(), { schema });
}

interface PgErrorLike {
  code?: string;
  message?: string;
  cause?: PgErrorLike;
}

export function classifyDatabaseError(error: unknown): {
  status: number;
  message: string;
} {
  const err = error as PgErrorLike | undefined;
  const code = err?.code || err?.cause?.code;

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return {
      status: 503,
      message:
        'Database host is unreachable from this environment. Replit internal hosts (such as "base") only resolve inside Replit; use a publicly reachable PostgreSQL URL here or run the app directly on Replit.',
    };
  }

  if (code === '42P01') {
    return {
      status: 503,
      message:
        'Database tables are not initialized yet. Run "npm run db:push" to apply the schema.',
    };
  }

  if (code === '28P01' || code === '28000') {
    return {
      status: 503,
      message: 'Database authentication failed. Check your DATABASE_URL credentials.',
    };
  }

  return {
    status: 500,
    message: 'Database request failed. Please try again.',
  };
}
