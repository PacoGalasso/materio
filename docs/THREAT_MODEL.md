# MATIÈRE — Threat Model

Written after the production-hardening implementation, so mitigations are described as they
actually exist in the code (with file references), not aspirationally. This is not a
certification of security; see the honesty note at the end.

## Assets

- **Customer business data**: weighing tickets, supplier/vehicle/material records, purchase
  prices, inventory movements, audit trail. Financially sensitive (purchase prices and
  volumes reveal a yard's commercial position) but not itself regulated personal data beyond
  ordinary B2B contact details (supplier contact names, phone, email).
- **Credentials**: password hashes (`account.password`, scrypt), session tokens
  (`session.token`).
- **Audit trail integrity**: `audit_events` is meant to be a trustworthy record of who did
  what; its value depends on nothing being able to write to it except the transaction that
  produced the event it describes.
- **Availability of the weighbridge workflow**: this is operational software running at a
  live weighbridge; an outage stops trucks from being processed.

## Trust boundaries

```
Internet ──HTTPS (at the reverse proxy/platform, not this app)──> Next.js app ──> PostgreSQL
                                                                        │
                                                                        └─> filesystem (none — no uploads/attachments in V1)
```

- **Browser ↔ app**: the only externally-reachable boundary. Everything the browser sends
  (form data, cookies, headers, URLs) is untrusted input.
- **App ↔ database**: trusted in the sense that the app owns the schema and issues
  parameterized queries only, but the database itself must still enforce what it can
  (foreign keys, check constraints, uniqueness — see `src/db/schema.ts`) as a second layer
  independent of application bugs.
- **App ↔ Better Auth internals**: Better Auth's own endpoints (`/api/auth/*`) are mounted
  inside this app's route handler (`src/app/api/auth/[...all]/route.ts`) and share its
  process/database; there is no separate identity provider to trust or distrust.

## Entry points

- Every route under `src/app/(workspace)/*` (session-gated by `src/proxy.ts` for UX, by
  `getOrgContext()`/`requireOrgContext()` for actual enforcement — see
  `src/server/context.ts`).
- Every Server Action under `src/server/actions/*.ts` — POST requests to the page that
  invoked them, not separate routes Proxy can be relied on to cover (see the comment atop
  `src/proxy.ts` and Next's own documentation on this point).
- `/api/auth/*` (Better Auth's sign-in/sign-out/session endpoints).
- `/api/health`, `/api/ready` (unauthenticated by design; return no internal detail).
- `/connexion` (public sign-in page).

## Threat actors / abuse cases and mitigations

### Broken access control / IDOR / BOLA

**Abuse case**: an authenticated user of organization A edits a URL, a Server Action's bound
id argument, or a query parameter to reference organization B's ticket/supplier/material/
vehicle/stock movement/audit record, hoping to read or mutate it.

**Mitigation**: `organizationId` is resolved exclusively from the session (never from any
client-supplied value) and every business-table lookup filters `WHERE organization_id = ?
AND id = ?` in the same query, so a foreign id resolves to "not found" rather than a
distinguishable error or real data. See `src/server/queries/*.ts` and
`src/server/use-cases/*.ts`. `material_prices` carries its own `organization_id` column
(not just a `material_id` FK) specifically so this holds without relying on a join.
Malformed ids (not a UUID) are rejected the same way, before ever reaching the database —
see `src/lib/id.ts` and its use at every id-taking query/use-case boundary.

**Verification**: `src/server/tenancy.test.ts` — a dedicated two-organization suite that
attempts every read and write above with organization A's session and organization B's ids.

**Residual risk**: this pattern must be maintained by discipline on every new query/use-case
added in the future; there is no framework-level enforcement (e.g. row-level security in
Postgres) as a second independent layer. Adding Postgres RLS policies would close that gap
and is a reasonable next step if the team wants defense in depth beyond application code.

### Authentication attacks

**Abuse case**: credential stuffing / brute-force login attempts; user enumeration via
different error messages for "unknown email" vs "wrong password".

**Mitigation**: Better Auth's rate limiter, configured with `storage: "database"` (Postgres,
not in-process memory — see `src/server/auth.ts`), a global 20 requests/minute default and a
stricter 5/minute rule on `/sign-in/email`. Both failure paths (unknown email, wrong
password) return the identical French message
`"Adresse e-mail ou mot de passe incorrect."` (`src/server/actions/auth.ts`,
`Better Auth`'s own `INVALID_EMAIL_OR_PASSWORD` code) and Better Auth deliberately still
hashes a dummy password on the "unknown email" path to avoid a timing side-channel. No public
sign-up exists (`emailAndPassword.disableSignUp: true`), removing the account-enumeration-via-
signup vector entirely.

**Verification**: `e2e/auth.spec.ts` asserts the identical message for both cases.

**Residual risk**: the rate limiter is per-identifier/IP; it does not defend against a
distributed attack from many IPs. That is a platform/WAF-layer concern, out of scope for the
application itself.

### Session theft / fixation

**Mitigation**: database-backed sessions (real server-side invalidation on logout, unlike a
JWT-only strategy), `HttpOnly` cookies, `Secure` in production
(`advanced.useSecureCookies`), sliding 14-day expiry with re-issue past the half-life.
Tokens are never placed in `localStorage`, `sessionStorage`, or a URL.

**Residual risk**: session fixation via a pre-set cookie is mitigated by Better Auth issuing
a fresh token on sign-in rather than reusing a client-supplied one; this was not independently
re-verified against Better Auth's internals in this pass (relying on the library's own
documented behavior for a well-established auth library, not re-implementing session
issuance ourselves).

### Privilege escalation

**Abuse case**: a VIEWER or OPERATOR calls a Server Action directly (bypassing UI that would
normally hide the control) to perform an action their role shouldn't allow, or tries to make
themselves OWNER.

**Mitigation**: every mutating Server Action calls `requireOrgContext(permission)`
(`src/server/context.ts`) before doing anything else, checking the session's *actual*
membership role — resolved server-side from the database, never accepted from the client.
There is no code path where a client can submit a `role` value that is trusted. The
permission matrix is centralized in `src/domain/authorization.ts`, not scattered
`if (role === ...)` checks.

**Verification**: `src/domain/authorization.test.ts` (the full role × permission matrix) and
the adversarial pass in `docs/PRODUCTION_READINESS.md`.

**Residual risk**: in-app member-role-change UI is not yet built (PARTIAL — see production
readiness report); role changes for existing members currently require direct database
access or a future admin UI, which is a smaller attack surface today but a usability gap.

### SQL injection

**Mitigation**: 100% of database access goes through Drizzle's query builder or its tagged
`sql` template (which parameterizes interpolated values); there is no string-concatenated
SQL anywhere in the codebase (verified by direct code review of every `sql\`...\`` usage in
`src/server/queries/*.ts`).

### XSS

**Mitigation**: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or
`document.write` anywhere in `src/` (verified directly). All user-supplied text (supplier
names, notes, etc.) renders through React's default escaping. A CSP is set
(`next.config.ts`) as defense in depth, though see the CSP note below for its one
acknowledged relaxation.

**Residual risk**: the CSP's `script-src` includes `'unsafe-inline'` (see the long comment in
`next.config.ts` for why — the App Router's own streaming renderer needs it, and a full
nonce-based CSP would force every route into dynamic rendering for a tradeoff not judged
worth it here). This means CSP alone would not stop a future inline-script-based XSS if one
were ever introduced; the primary defense remains "no injection point exists," not the
header.

### CSRF

**Mitigation**: Server Actions are same-origin POSTs; Next.js verifies the request's
`Origin` header against the deployment's allowed origins for state-changing Server Action
calls. Session cookies are not `SameSite=None`. No separate CSRF token was added — see
`src/proxy.ts`'s header comment and the mandate's own guidance against blindly bolting one
on. Because state-changing requests require a matching `Origin`, an attacker's page cannot
successfully trigger one cross-site even with the victim's cookie attached.

### SSRF

Not applicable in this phase: the app makes no outbound requests based on user input (no
webhook URLs, no "fetch this image" style feature).

### Command injection / path traversal

Not applicable: no `child_process`, no filesystem access driven by user input (verified
directly — grep for `child_process`, `exec(`, `spawn(` across `src/` returns nothing).

### Unsafe redirects

All `redirect()` calls in the codebase go to hardcoded internal paths or a
`next.startsWith("/")`-validated relative path from the sign-in flow
(`src/server/actions/auth.ts`) — never an unvalidated absolute URL from user input.

### Mass assignment

Every Server Action parses `FormData` through an explicit Zod schema
(`src/server/validation/*.ts`) that names each field; nothing does a blanket
`Object.assign(record, formData)`-style spread of untrusted input into a database write.

### Race conditions

See `src/server/use-cases/concurrency.test.ts`: two concurrent completions of the same
ticket, and two concurrent stock-affecting operations that would individually succeed but
together would take stock negative, are both tested against genuinely concurrent calls (not
sequential awaits) and rely on `SELECT ... FOR UPDATE` row locks added in the Postgres
migration (`src/server/use-cases/weighing.ts`, `src/server/use-cases/inventory.ts`).

### Tenancy leakage / information disclosure

Covered above under IDOR. Additionally: production error responses never include stack
traces, SQL text, or file paths (`src/app/(workspace)/error.tsx` only ever shows one of a
small allow-list of hand-written safe messages, or a generic fallback); `/api/health` and
`/api/ready` return no version/host/environment detail.

### Secrets leakage

Covered in `docs/PRODUCTION_READINESS.md`'s secret-scan section. `src/env/server.ts` is the
single point where required secrets are read and validated; its own failure message names
the missing variable but never a value (tested in `src/env/server.test.ts`).

### Dependency compromise

`npm audit` run against production dependencies only: 0 high/critical. See
`docs/PRODUCTION_READINESS.md` for the full result and the one accepted moderate,
dev-only finding. Dependabot is configured for both `npm` and `github-actions` ecosystems.

### CI compromise

`.github/workflows/ci.yml` grants only `contents: read`; no secrets are exposed to
pull-request runs (there are none defined); third-party actions are limited to GitHub's own
first-party `actions/checkout` and `actions/setup-node`, pinned to major version tags (see
the workflow's own comment on why a hand-copied SHA was judged riskier here); no
`pull_request_target` is used anywhere.

## Non-negotiable honesty note

This document describes mitigations implemented and how they were verified in this session.
It is not a claim of "100% secure," "no vulnerabilities," or legal compliance with any
framework. Residual risks are called out inline above rather than omitted. A real security
review by an independent party is recommended before onboarding a paying customer's live
data, and periodically thereafter.
