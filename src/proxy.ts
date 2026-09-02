/**
 * Session gate for page loads, and the sole source of truth for "is this session valid" that
 * a redirect decision is based on — see the regression this guards against below.
 *
 * This used to do a cheap cookie-*presence* check only (`better-auth/cookies`'s
 * `getSessionCookie`), which does no signature or database validation at all — it just
 * returns the raw cookie value if the cookie exists. That created a real bug: a session
 * cookie that is present but invalid (its signature no longer matches — e.g. after
 * BETTER_AUTH_SECRET changes — or its underlying DB row expired/was deleted) made this file
 * treat the visitor as authenticated, while the *actual* validation in
 * `getOrgContext()` (src/server/context.ts, called from every page) correctly found the
 * session invalid and redirected to /connexion. Neither layer ever cleared the bad cookie,
 * so the two layers disagreed forever: this file bounced `/connexion` → `/` (cookie present),
 * the page bounced `/` → `/connexion` (session invalid) — an infinite 307 loop, reproduced
 * with a stale cookie via curl before this fix and covered by e2e/redirects.spec.ts after it.
 *
 * The fix is to make the *same* real validation (`auth.api.getSession`) the single source of
 * truth here too, so this file and getOrgContext() can never disagree, and to clear a
 * rejected cookie so a stale one can't cause a repeat. This does cost one DB round trip per
 * navigation (not per asset — see the matcher below) instead of being free; at this app's
 * scale (a handful of concurrent yard operators) that's a deliberate, acceptable trade for an
 * invariant ("never a redirect loop") that a signature-only or presence-only check cannot
 * guarantee for every invalid-session cause.
 *
 * Server Actions are a separate concern from all of this: they are not reliably covered by
 * Proxy at all (a matcher change can silently stop protecting one), so every server action
 * and page independently calls getOrgContext()/requireOrgContext() in src/server/context.ts,
 * which remains the actual authorization enforcement point regardless of what this file does.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/server/auth";

const PUBLIC_PATHS = new Set(["/connexion"]);

/** Matches getSessionCookie's own name/prefix logic (src/proxy.ts has no other source for
 * this), so a rejected session's cookie is actually cleared under the name it was set with. */
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * True only when the request actually arrived over HTTPS — either terminated directly, or
 * forwarded by a reverse proxy that sets the standard `x-forwarded-proto` header. Sending
 * Strict-Transport-Security when this is false previously made Chrome register an HSTS
 * policy for `localhost` during local testing and force-upgrade every later request to
 * `https://localhost`, breaking the app outright (see next.config.ts for the full story).
 */
function isHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function clearSessionCookie(response: NextResponse): void {
  for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  // Real validation (DB-backed, same call getOrgContext makes) — not a cheap presence check.
  // This is what actually fixes the loop: this file and getOrgContext can no longer disagree
  // about whether the session is valid.
  const session = await auth.api.getSession({ headers: request.headers });
  const isAuthenticated = Boolean(session);

  let response: NextResponse;
  if (PUBLIC_PATHS.has(pathname)) {
    response = isAuthenticated ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  } else if (!isAuthenticated) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("suivant", pathname);
    response = NextResponse.redirect(url);
    // A rejected-but-present cookie (stale signature, expired/deleted session row, etc.) must
    // not survive to be re-sent on the very next request — that's what made the loop a loop.
    clearSessionCookie(response);
  } else {
    response = NextResponse.next();
  }

  if (isHttps(request)) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts/).*)"],
};
