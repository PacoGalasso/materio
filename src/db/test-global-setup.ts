/**
 * Vitest `globalSetup`: runs once before any test file, against the dedicated `matiere_test`
 * Postgres database (never the dev or e2e database). Drops and recreates the public schema
 * so every test run starts from an identical, freshly-migrated baseline, then applies
 * migrations. Individual tests get isolation from each other by scoping their fixture data
 * to a fresh `organizationId` (see `./test-db.ts`), not by a separate schema per test.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://matiere:matiere@localhost:55432/matiere_test";

export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  try {
    // Drizzle's migration tracking table lives in its own "drizzle" schema, separate from
    // "public" — drop both, otherwise the migrator sees migrations already marked applied
    // (from a previous run) and skips recreating the tables we just wiped.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("CREATE SCHEMA public");
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
