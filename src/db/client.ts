import { Pool, types, type PoolConfig } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { serverEnv } from "@/env/server";

import * as schema from "./schema";

/**
 * Postgres reports `SUM()`/`COUNT()` over our `integer` columns as `bigint` (OID 20), which
 * node-postgres parses as a string by default to avoid silent precision loss for values
 * beyond `Number.MAX_SAFE_INTEGER`. Every weight/money/count value in this app is bounded to
 * a safe integer by domain assertions (`assertWeight`, `assertUnitPrice`) and business scale,
 * so parsing bigint as a number here is safe and avoids scattering `::int` casts across every
 * aggregate query in `src/server/queries`.
 */
types.setTypeParser(20, (value: string) => parseInt(value, 10));

export type Database = NodePgDatabase<typeof schema>;
/** Transaction handle passed to `withTransaction` callbacks. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Either the root database or a transaction handle; read helpers accept both. */
export type DatabaseExecutor = Database | Transaction;

export interface DatabaseHandle {
  db: Database;
  pool: Pool;
}

/**
 * Opens a pooled Postgres connection. A small pool is appropriate for a single-instance
 * deployment; if the app is ever horizontally scaled, size this against the managed
 * Postgres provider's own connection limit (see docs/DEPLOYMENT.md).
 */
export function createDatabase(connectionString: string = serverEnv().DATABASE_URL): DatabaseHandle {
  const poolConfig: PoolConfig = { connectionString, max: 10 };
  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema });
  return { db, pool };
}

declare global {
  // Cached across hot reloads in development so we do not leak connections.
  var __matiereDatabase: DatabaseHandle | undefined;
}

function sharedHandle(): DatabaseHandle {
  if (!globalThis.__matiereDatabase) {
    globalThis.__matiereDatabase = createDatabase();
  }
  return globalThis.__matiereDatabase;
}

/** Application-wide database handle (lazy singleton). */
export function getDb(): Promise<Database> {
  return Promise.resolve(sharedHandle().db);
}

/**
 * Synchronous access to the same lazy singleton as `getDb()`, for callers that must
 * construct something (like the Better Auth instance) at module init time rather than
 * inside an async function.
 */
export function getDbSync(): Database {
  return sharedHandle().db;
}

/**
 * Runs `fn` inside a real Postgres transaction. Concurrency safety for rows read-then-written
 * in the same transaction (ticket completion, stock-affecting movements) comes from explicit
 * `SELECT ... FOR UPDATE` locks taken inside `fn`, not from any serialization at this layer —
 * Postgres's MVCC + row locks handle genuine concurrent writers correctly, unlike the
 * SQLite-era in-process queue this replaces.
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}
