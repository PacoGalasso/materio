import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import { createDatabase, type Database } from "./client";
import { databaseUrl } from "./config";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Applies pending SQL migrations from ./drizzle to the given database. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

async function main(): Promise<void> {
  const url = databaseUrl();
  const { db, client } = await createDatabase(url);
  try {
    await runMigrations(db);
    console.log(`Migrations applied to ${url}`);
  } finally {
    client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
}
