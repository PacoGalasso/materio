import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase, type Database } from "./client";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Applies pending SQL migrations from ./drizzle to the given database. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

async function main(): Promise<void> {
  const { db, pool } = createDatabase();
  try {
    await runMigrations(db);
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
}
