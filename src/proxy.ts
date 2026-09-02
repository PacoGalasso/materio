/**
 * Redirect-only gate for page loads: a cheap cookie-presence check (no DB round trip), used
 * purely for UX (send an unauthenticated visitor to /connexion, send an authenticated one
 * away from /connexion). This is NOT the real authorization boundary — Server Actions are
 * not separate routes Proxy can reliably cover (a matcher change can silently stop protecting
 * one), so every server action and page independently calls getOrgContext()/requireRole in
 * src/server/context.ts, which is the actual enforcement point.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/connexion"]);

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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  let response: NextResponse;
  if (PUBLIC_PATHS.has(pathname)) {
    response = hasSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  } else if (!hasSession) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("suivant", pathname);
    response = NextResponse.redirect(url);
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
