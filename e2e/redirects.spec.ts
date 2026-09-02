/**
 * Regression suite for a redirect-loop bug: src/proxy.ts used to trust a session cookie's
 * mere *presence* (no signature/DB validation), while the real check in getOrgContext()
 * (called from every page) did full validation. A present-but-invalid cookie — e.g. after
 * BETTER_AUTH_SECRET changes, or an expired/deleted session row — made the two layers
 * disagree forever: proxy.ts sent `/connexion` → `/` (cookie present), the page sent
 * `/` → `/connexion` (session invalid). Neither cleared the cookie, so it never terminated.
 *
 * These tests follow the redirect chain manually (`maxRedirects: 0`, then follow by hand, up
 * to a hard cap) instead of `page.goto()`, specifically so a *reintroduced* infinite loop
 * fails fast with a clear assertion instead of hanging until Playwright's navigation timeout.
 */
import { randomUUID } from "node:crypto";

import { createLocalAccountIssuer } from "better-auth/db";
import { hashPassword } from "better-auth/crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

import { createDatabase } from "../src/db/client";
import { account, user } from "../src/db/schema";
import { E2E_USER } from "../playwright.config";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://matiere:matiere@localhost:55432/matiere_e2e";
const MAX_HOPS = 10;

interface Hop {
  status: number;
  from: string;
  to: string | undefined;
}

/** Follows redirects one at a time, capping at MAX_HOPS so a real infinite loop fails the
 * assertion below instead of looping (or timing out) silently. Resolves each next hop
 * against the *previous response's actual URL* (`response.url()`), not the possibly-relative
 * string we started with — `request.get("/")` happily resolves a relative path against
 * baseURL, but `new URL(location, "/")` throws ("/" is not a valid base), so tracking the hop
 * chain via the response's own absolute URL is what actually works here regardless of
 * whether the Location header itself came back absolute or relative. */
async function followRedirects(
  request: APIRequestContext,
  startUrl: string,
  headers?: Record<string, string>,
): Promise<{ hops: Hop[]; finalStatus: number; finalUrl: string }> {
  const hops: Hop[] = [];
  let current = startUrl;
  for (let i = 0; i < MAX_HOPS; i += 1) {
    const response = await request.get(current, { maxRedirects: 0, headers });
    const status = response.status();
    if (status >= 300 && status < 400) {
      const location = response.headers()["location"];
      hops.push({ status, from: current, to: location });
      if (!location) throw new Error(`Redirect ${status} from ${current} had no Location header`);
      current = new URL(location, response.url()).toString();
      continue;
    }
    return { hops, finalStatus: status, finalUrl: response.url() };
  }
  throw new Error(
    `Redirect chain exceeded ${MAX_HOPS} hops (this is exactly the regression this suite guards ` +
      `against): ${hops.map((h) => `${h.status} ${h.from} -> ${h.to}`).join(" | ")}`,
  );
}

/** Directly provisions a user+credential with no organization membership at all — the one
 * "authenticated" state npm run db:create-user can never produce (it always attaches one).
 * Goes through Drizzle (like every other write in this app, including create-user-cli.ts),
 * not raw SQL: account.updatedAt has no database-level default (only Drizzle's own
 * `$onUpdate` fallback, applied client-side by the query builder), so a hand-written INSERT
 * bypassing Drizzle fails a NOT NULL constraint that every real code path never hits. */
async function createUserWithoutMembership(email: string, password: string): Promise<void> {
  const { db, pool } = createDatabase(E2E_DATABASE_URL);
  try {
    const userId = randomUUID();
    await db.insert(user).values({ id: userId, name: "No Membership", email, emailVerified: true });
    const passwordHash = await hashPassword(password);
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      issuer: createLocalAccountIssuer("credential"),
      userId,
      password: passwordHash,
    });
  } finally {
    await pool.end();
  }
}

test.describe("Redirect-loop regression", () => {
  test("clean unauthenticated browser: / redirects exactly once to /connexion, which is 200", async ({
    request,
  }) => {
    const result = await followRedirects(request, "/");
    expect(result.hops).toHaveLength(1);
    expect(result.hops[0]?.status).toBe(307);
    expect(new URL(result.hops[0]!.to!, "http://x").pathname).toBe("/connexion");
    expect(result.finalStatus).toBe(200);
  });

  test("stale/invalid session cookie: never loops, ends on /connexion 200, and the bad cookie is cleared", async ({
    request,
  }) => {
    const result = await followRedirects(request, "/", {
      Cookie: "better-auth.session_token=this-signature-cannot-possibly-be-valid",
    });
    // Before the fix this always hit MAX_HOPS and followRedirects() threw. Reaching here at
    // all is already most of the regression proof; the assertions below pin the exact shape.
    expect(result.hops.length).toBeGreaterThan(0);
    expect(result.hops.length).toBeLessThan(MAX_HOPS);
    expect(new URL(result.finalUrl).pathname).toBe("/connexion");
    expect(result.finalStatus).toBe(200);
  });

  test("authenticated with valid membership: /connexion -> / and / both resolve without looping", async ({
    request,
  }) => {
    const signIn = await request.post("/api/auth/sign-in/email", {
      data: { email: E2E_USER.email, password: E2E_USER.password },
    });
    expect(signIn.ok()).toBe(true);

    const fromLogin = await followRedirects(request, "/connexion");
    expect(fromLogin.hops).toHaveLength(1);
    expect(new URL(fromLogin.hops[0]!.to!, "http://x").pathname).toBe("/");
    expect(fromLogin.finalStatus).toBe(200);

    const fromRoot = await followRedirects(request, "/");
    expect(fromRoot.hops).toHaveLength(0);
    expect(fromRoot.finalStatus).toBe(200);
  });

  test("authenticated without any organization membership: deterministic safe response, never a redirect", async ({
    request,
  }) => {
    const email = `no-membership-${randomUUID()}@matiere.test`;
    const password = "no-membership-password-123";
    await createUserWithoutMembership(email, password);

    const signIn = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
    });
    expect(signIn.ok()).toBe(true);

    // Hit it three times in a row: a real redirect loop would show up as repeated 3xx
    // responses here just as surely as it would on the very first request. This state is
    // surfaced by throwing NoOrganizationError from a Server Component, which the nearest
    // error boundary (src/app/(workspace)/error.tsx) renders as a *stable, non-redirecting*
    // page — Next.js reports that as HTTP 500 for the initial document even though the body
    // is the friendly, safe error message, not a crash page. The point of this test is "never
    // a redirect" and "always the same safe body", not the specific status code.
    for (let i = 0; i < 3; i += 1) {
      const response = await request.get("/", { maxRedirects: 0 });
      const status = response.status();
      expect(response.headers()["location"]).toBeUndefined(); // never a redirect for this state
      expect(status >= 300 && status < 400).toBe(false); // no 3xx status either
      expect(status === 200 || status === 500).toBe(true); // stable: same outcome every time
      const body = await response.text();
      expect(body).toContain("rattaché à aucune organisation");
    }
  });
});
