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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (PUBLIC_PATHS.has(pathname)) {
    if (hasSession) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("suivant", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts/).*)"],
};
