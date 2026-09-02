/**
 * Application authentication instance. Email/password only (no public sign-up — see
 * src/db/create-user-cli.ts for how accounts are provisioned), database-backed sessions
 * (real server-side logout invalidation, unlike a JWT-only strategy), scrypt password
 * hashing (Better Auth's default — pure JS, no native module).
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDbSync } from "@/db/client";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { serverEnv } from "@/env/server";

export const auth = betterAuth({
  database: drizzleAdapter(getDbSync(), {
    provider: "pg",
    schema: { user, session, account, verification, rateLimit },
  }),
  secret: serverEnv().BETTER_AUTH_SECRET,
  baseURL: serverEnv().BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // No self-service registration: accounts are provisioned by whoever operates the
    // deployment (npm run db:create-user), not through this running app's HTTP surface.
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: {
    // 14-day sliding session; re-issued once past the half-life so an active user is never
    // abruptly logged out, while an abandoned session still expires.
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24 * 7,
  },
  advanced: {
    // Secure cookies only make sense once the app is actually served over HTTPS.
    useSecureCookies: serverEnv().NODE_ENV === "production",
  },
  rateLimit: {
    enabled: true,
    // Stored in Postgres (not in-process memory), so the limit holds even if the app is
    // ever run as more than one instance — see docs/PRODUCTION_READINESS.md.
    storage: "database",
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  plugins: [nextCookies()],
});
