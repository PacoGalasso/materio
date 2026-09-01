import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_DATABASE_URL = "file:./data/matiere.db";

let envLoaded = false;

/**
 * Loads `.env` once for standalone scripts (migrate, seed). Next.js loads it on its own.
 * Uses Node's built-in loader so the project needs no dotenv dependency.
 */
function loadEnvFileOnce(): void {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // A malformed .env must not break startup; defaults apply.
    }
  }
}

/** Returns the libsql connection URL, defaulting to a local SQLite file under ./data. */
export function databaseUrl(): string {
  loadEnvFileOnce();
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : DEFAULT_DATABASE_URL;
}

/** Absolute filesystem path for `file:` URLs, or null for non-file databases (e.g. :memory:). */
export function databaseFilePath(url: string = databaseUrl()): string | null {
  if (!url.startsWith("file:")) return null;
  const raw = url.slice("file:".length);
  if (raw === ":memory:" || raw.length === 0) return null;
  // The URL is configuration, not a module path: no need for Turbopack to trace the project.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}
