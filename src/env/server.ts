/**
 * Single server-side environment boundary. Parsed once at import time so a missing or
 * malformed required variable fails startup immediately, with a message that names the
 * variable but never its value. Nothing here is exposed to client bundles: this module is
 * only ever imported from server-only code (db, auth, use cases).
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

let envFileLoaded = false;

/** Loads `.env` once for standalone scripts (migrate, seed, CLI). Next.js loads it on its own. */
function loadEnvFileOnce(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // A malformed .env must not break startup; required vars are still validated below.
    }
  }
}

loadEnvFileOnce();

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, "DATABASE_URL is required (a PostgreSQL connection string)."),
  BETTER_AUTH_SECRET: z
    .string()
    .trim()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)."),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL, e.g. http://localhost:3000."),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(
      `Invalid server environment configuration:\n${missing.join("\n")}\n` +
        "Copy .env.example to .env and fill in the required values.",
    );
  }
  return parsed.data;
}

let cachedEnv: ServerEnv | undefined;

/** Validated server environment (lazy singleton so import order never matters). */
export function serverEnv(): ServerEnv {
  if (!cachedEnv) cachedEnv = loadServerEnv();
  return cachedEnv;
}
