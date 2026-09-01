import { mkdirSync } from "node:fs";
import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { databaseFilePath, databaseUrl } from "./config";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;
/** Transaction handle passed to `withTransaction` callbacks. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Either the root database or a transaction handle; read helpers accept both. */
export type DatabaseExecutor = Database | Transaction;

export interface DatabaseHandle {
  db: Database;
  client: Client;
}

const clients = new WeakMap<Database, Client>();

/**
 * Per-connection settings. SQLite does not enforce foreign keys unless asked on every
 * connection, and the libsql client opens a fresh connection after each transaction.
 */
async function applyConnectionPragmas(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA busy_timeout = 5000");
}

/** Opens a database, creating the folder for file databases and applying connection settings. */
export async function createDatabase(url: string = databaseUrl()): Promise<DatabaseHandle> {
  const filePath = databaseFilePath(url);
  if (filePath) {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const client = createClient({ url });
  await applyConnectionPragmas(client);
  if (filePath) {
    // Journal mode is persisted in the file: readers never block the single writer.
    await client.execute("PRAGMA journal_mode = WAL");
  }
  const db = drizzle(client, { schema });
  clients.set(db, client);
  return { db, client };
}

let transactionQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs `fn` inside a transaction with foreign keys enforced.
 *
 * The libsql client gives the transaction its *current* connection and lazily opens another
 * one afterwards, so the pragmas are re-applied right before BEGIN. Transactions are queued
 * in-process so no other transaction can swap the connection in between; SQLite serializes
 * writers anyway, so this costs nothing.
 *
 * Every write in the application goes through this helper.
 */
export async function withTransaction<T>(
  db: Database,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const client = clients.get(db);
  const run = async (): Promise<T> => {
    if (client) await applyConnectionPragmas(client);
    return db.transaction(fn);
  };
  const result = transactionQueue.then(run, run);
  transactionQueue = result.catch(() => undefined);
  return result;
}

declare global {
  // Cached across hot reloads in development so we do not leak connections.
  var __matiereDatabase: Promise<DatabaseHandle> | undefined;
}

/** Application-wide database handle (lazy singleton). */
export function getDb(): Promise<Database> {
  if (!globalThis.__matiereDatabase) {
    globalThis.__matiereDatabase = createDatabase();
  }
  return globalThis.__matiereDatabase.then((handle) => handle.db);
}
