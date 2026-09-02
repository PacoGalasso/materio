import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Scoped to what this app actually loads: same-origin scripts/styles/fonts, self-hosted
 * images (`data:` for a few inline SVGs in the UI), no external origins at all. `frame-src`
 * and `frame-ancestors` are both locked down since nothing here is meant to be framed or to
 * frame anything else. Revisit this if a future feature needs another origin — do not widen
 * it "just in case".
 */
/**
 * `script-src` carries 'unsafe-inline': the App Router's streaming renderer injects small
 * inline scripts of its own (to patch resolved Suspense/loading-boundary content into the
 * page as it streams in) with no way to opt out short of a full nonce-based CSP — which
 * requires generating a fresh nonce per request in src/proxy.ts, forces every route into
 * dynamic rendering, and disables static optimization/ISR (see Next's own CSP guide). That
 * tradeoff isn't justified for this app's size; this follows Next's own documented
 * "Without Nonces" fallback instead. Confirmed by testing an actual `next build && next
 * start`: a strict `script-src 'self'` (no 'unsafe-inline') let the page shell and its real,
 * already-resolved content both render into the DOM, but silently — no console error, no
 * visible CSP violation — left the loading skeleton on screen forever, because the inline
 * script that swaps the two never ran. The residual XSS risk this accepts is bounded: the
 * codebase has no `dangerouslySetInnerHTML`, `eval`, or `innerHTML` usage (verified directly,
 * see docs/THREAT_MODEL.md), so there's no known injection point for an attacker to exploit
 * via this relaxation today — but it does mean CSP alone would not stop a future one.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-eval' is additionally needed only in dev: Turbopack's HMR runtime and React's
  // dev-mode error-stack reconstruction both use eval; neither ships in the production build.
  isProduction ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'", // Tailwind's arbitrary-value utilities and a few
  // inline chart styles rely on inline `style` attributes.
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep demos clean: no floating dev badge (the error overlay stays active).
  devIndicators: false,
  // The project maintains its own CLAUDE.md; do not regenerate AGENTS.md on every dev start.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          // Strict-Transport-Security is NOT set here: this static header list can't tell
          // whether the actual incoming connection is HTTPS (Next.js typically sits behind a
          // TLS-terminating reverse proxy that talks plain HTTP to it). Sending HSTS
          // unconditionally over what the browser sees as plain HTTP made Chrome register an
          // HSTS policy for the host and force-upgrade every later request to https, breaking
          // local testing outright. See src/proxy.ts, which sets it only when the request was
          // actually forwarded as HTTPS, and docs/DEPLOYMENT.md for the alternative of setting
          // it at the reverse proxy/CDN layer instead.
        ],
      },
    ];
  },
};

export default nextConfig;
