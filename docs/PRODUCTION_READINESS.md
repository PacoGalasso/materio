# Production Readiness Report

Written at the end of the production-hardening phase on `claude/production-hardening`.
Statuses: **PASS** (implemented and verified), **PARTIAL** (implemented but with a known,
stated gap), **BLOCKER** (not implemented, must be resolved before production use),
**NOT_APPLICABLE**.

No absolute claims are made anywhere in this report — "100% secure," "no vulnerabilities,"
and "fully compliant" are claims this report deliberately avoids, per this project's own
stated non-negotiable-honesty requirement. A passing test suite is evidence, not proof.

## Architecture — PASS

Modular monolith preserved (browser → Next.js → auth/session → org context/authorization →
server actions → use cases → domain → persistence → PostgreSQL). No microservices, queues,
or unnecessary infrastructure introduced.

## Database — PASS

PostgreSQL 16 replaces SQLite. Migrations only (`drizzle/*.sql`), no `db push` anywhere in
the documented workflow. Verified: fresh `docker compose up -d db` → `npm run db:migrate`
succeeds from an empty database. Foreign keys, unique constraints, and check constraints
(non-negative weights/prices) carry over from V1 and were re-verified
(`src/db/integrity.test.ts`). Row-level concurrency control (`SELECT ... FOR UPDATE`)
replaces the SQLite-era in-process transaction queue — verified under genuine concurrent
load, not just sequential awaits (`src/server/use-cases/concurrency.test.ts`).

## Authentication — PARTIAL

Better Auth (email/password, database-backed sessions, scrypt hashing) implemented and
verified end-to-end (`e2e/auth.spec.ts`, plus a manual browser session against both `npm run
dev` and a real `next build && next start`). No public self-registration
(`disableSignUp: true`) — a deliberate scope decision for private B2B software, documented in
`docs/DEPLOYMENT.md`.

**Gap**: no self-service password reset (would require an email delivery provider, out of
scope for this phase — see `src/server/auth.ts`'s comments). Operational recovery today
means re-running `npm run db:create-user` for that email, which re-attaches the account
without touching membership history but does require issuing a new password out-of-band.

## Authorization — PARTIAL

Centralized policy (`src/domain/authorization.ts`), enforced at the top of every Server
Action via `requireOrgContext(permission)`. Full role × permission matrix unit-tested
(`src/domain/authorization.test.ts`). Verified structurally (every mutating action checked)
and via the adversarial pass below.

**Gap**: no in-app UI or Server Action exists yet to change an existing member's role or add
a new member (`MEMBER_INVITED`/`MEMBER_ROLE_CHANGED` audit actions are defined in the schema
and ready to be written to, but nothing currently triggers them). Today, membership changes
require the `npm run db:create-user` CLI (idempotent, re-attaches with a new role) run by
whoever operates the deployment. Building the in-app version is the most valuable next piece
of work after this phase.

## Tenant isolation — PASS

Organization identity resolved exclusively from the session; never accepted from client
input anywhere (verified: no validation schema in `src/server/validation/*.ts` accepts an
`organizationId` or `role` field). Every business-table query/use-case filters by
organization id in the same query. Dedicated two-organization IDOR suite
(`src/server/tenancy.test.ts`) covers tickets, suppliers, vehicles, materials, prices,
stock, and audit events across reads and writes.

## Environment variables — PASS

Single validated boundary (`src/env/server.ts`); missing/malformed required variables fail
fast with a message naming the variable, never a value (`src/env/server.test.ts`). No
`NEXT_PUBLIC_*` variables exist in this app.

## Sessions — PASS

Database-backed (real server-side logout invalidation), `HttpOnly`, `Secure` in production,
14-day sliding expiry. No token in `localStorage`/`sessionStorage`/a URL anywhere (verified
by code review).

## CSRF — PASS

Relies on Next.js's built-in same-origin enforcement for Server Actions plus `SameSite=Lax`
cookies; reasoning documented in `docs/THREAT_MODEL.md` and `src/proxy.ts` rather than a
bolted-on token.

## Security headers — PARTIAL

`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP are set
(`next.config.ts`); `Strict-Transport-Security` is set conditionally in `src/proxy.ts`, only
when the request actually arrived as HTTPS.

**Gap**: the CSP's `script-src` includes `'unsafe-inline'`. This was not a shortcut — a
strict `script-src 'self'` was implemented first, and testing an actual `next build && next
start` in a real browser (not just `next dev`) found it silently broke every authenticated
page: the App Router's own streaming renderer injects small inline scripts to patch resolved
content into the page, and blocking them left the loading skeleton on screen forever with no
console error. The fix follows Next's own documented fallback for apps not implementing a
full nonce-based CSP (which would force every route into dynamic rendering and disable
static optimization — not judged worth it here). Full reasoning and the accepted residual
risk are in `next.config.ts`'s comment and `docs/THREAT_MODEL.md`.

## Input validation — PASS

Every Server Action parses `FormData` through an explicit Zod schema. Weight/price
validation gained a business-sane upper bound this phase (previously only non-negative +
safe-integer) — `MAX_WEIGHT_G` / `MAX_UNIT_PRICE_CTS_PER_T` in `src/domain/units.ts`, tested
directly. Malformed/non-UUID ids are rejected before reaching the database
(`src/lib/id.ts`), avoiding a raw driver error.

## Audit logging — PASS

`audit_events` (append-only, no UI path to edit) written inside the same transaction as the
business write it records, for every use case the mandate lists that exists in this app:
weighing created/completed/cancelled, inventory adjusted/dispatched, material
created/updated/price changed, supplier created/updated, organization settings updated.
`MEMBER_INVITED`/`MEMBER_ROLE_CHANGED`/`MEMBER_REMOVED` action codes exist in the schema but
have no writer yet (see the Authorization gap above). No OWNER/ADMIN read-only audit-log
viewer UI was built in this phase (PARTIAL) — the data is there; querying it today requires
direct database access.

## Logging — PASS

No secrets, tokens, cookies, or authorization headers appear in any log statement (verified
by code review of every `console.*` call in `src/`). Migration/seed scripts log outcomes
without echoing connection strings.

## Errors — PASS

Production error responses never include stack traces, SQL text, or file paths
(`src/app/(workspace)/error.tsx` only renders one of a small allow-list of hand-written safe
messages or a generic fallback).

## Dependency security — PASS (with one accepted, documented risk)

`npm audit --omit=dev`: **0 high/critical, 0 findings against production runtime
dependencies.** 4 moderate findings remain, all in the dev-only chain
`drizzle-kit → @esbuild-kit/esm-loader → esbuild` (GHSA-67mh-4wv8-2f99, a dev-server-only
issue with no non-breaking fix currently published upstream — the only available fix is a
downgrade to `drizzle-kit@0.18.1`, judged worse than the risk it avoids). This is dev-tooling
only, never shipped in the production bundle or build output. Accepted risk, monitored, not
silently ignored — re-check when drizzle-kit publishes a fix.

`npm outdated`: four dev-only major-version bumps available (`@playwright/test`, `@types/
node`, `eslint`, `typescript`) — not applied in this phase to avoid an unrelated,
unreviewed scope expansion; a reasonable next-maintenance-window task.

## CI — PASS

`.github/workflows/ci.yml`: typecheck, lint, format check, unit/integration tests (against a
real Postgres service container), production build, and a dependency audit gate, on every
PR and push to `main`/`claude/production-hardening`. `permissions: contents: read` only. No
secrets are defined in the repository, so none can leak to a PR run. Third-party actions
limited to GitHub's own first-party `actions/checkout`/`actions/setup-node`.
`.github/workflows/codeql.yml` adds JS/TS static analysis (weekly + on push/PR).
`.github/dependabot.yml` covers both `npm` and `github-actions` ecosystems weekly.

## Backups — PARTIAL (specification only)

`docs/BACKUP_RESTORE.md` documents the intended approach (managed-provider automatic
backups + PITR, RPO/RTO targets, restore process) but **no backup infrastructure has
actually been provisioned** — there is no production database yet to back up. The restore
process has not been tested end-to-end in this phase.

## Deployment — PARTIAL (specification only)

`docs/DEPLOYMENT.md` documents topology, build, migration sequencing, first-user
provisioning, health checks, rollback, and connection pooling. **No actual deployment has
occurred**; no hosting platform or managed Postgres provider has been chosen.

## Data protection — PARTIAL (specification only)

`docs/DATA_PROTECTION.md` documents categories of personal data, purpose, minimization,
retention considerations, and access control. **No legal review has been performed**, no
data-subject-rights (export/deletion) self-service flow exists.

## Tests — PASS

**98 unit/integration tests** (`npm test`, Vitest against real Postgres), covering domain
rules, use cases, database integrity, authorization, tenancy/IDOR, transaction concurrency,
and environment validation — up from the pre-hardening baseline of 66 (all originally
SQLite-backed tests ported to Postgres and still passing, plus 32 new tests). Verified
stable across three consecutive full runs (no flakiness under the shared-test-database
design — see `src/db/test-db.ts`'s doc comment for why fixtures share one connection pool).

**12 end-to-end tests** (`npm run test:e2e`, Playwright against a real browser and a real
Postgres database), including three new authentication flows (unauthenticated redirect +
return, generic invalid-credentials message, sign-out invalidation) alongside the original
weighing/ticket/management flows, all passing under the new auth-gated app.

## Observability — PARTIAL

`/api/health` (liveness) and `/api/ready` (liveness + live DB check) implemented, neither
leaking version/host/environment detail. No structured-logging library, metrics, or tracing
integration was added — `console.*` remains the only logging mechanism, consistent with
"keep logging simple" and appropriate for this deployment's current scale; revisit if/when
multi-instance operation makes correlating logs across instances necessary.

## Known risks (residual, going into a first pilot)

1. CSP's `script-src 'unsafe-inline'` (see Security headers above) — bounded today by "no
   known injection point exists," not by the header itself.
2. No in-app membership management (invite/role-change/remove) — CLI-only today.
3. No self-service password reset — CLI-only recovery today.
4. Rate limiting is correctly Postgres-backed (not in-memory), but still per-identifier —
   does not defend against a distributed attack from many source IPs; that's a platform/WAF
   concern.
5. No Postgres row-level security (RLS) as an independent second layer under application-
   level tenant scoping — the application layer is the only enforcement point today.
6. `drizzle-kit`'s dev-only moderate `npm audit` finding, tracked above.
7. No backup/deployment infrastructure actually provisioned — both documents are
   specifications for the team to execute against, not descriptions of a live environment.

## Before onboarding the first real customer

- [ ] Choose and provision a managed PostgreSQL instance on a private network; confirm
      automatic backups + PITR are enabled (`docs/BACKUP_RESTORE.md`).
- [ ] Choose a hosting platform, provision TLS/a domain, and perform one real deployment
      following `docs/DEPLOYMENT.md`.
- [ ] Generate a unique, real `BETTER_AUTH_SECRET` for production — never reuse the
      dev/test/CI values.
- [ ] Run `npm run db:migrate` then `npm run db:create-user` to provision the first OWNER.
- [ ] Actually perform one restore-from-backup test end-to-end (`docs/BACKUP_RESTORE.md`).
- [ ] Get a qualified legal review of `docs/DATA_PROTECTION.md` before processing that
      customer's real personal/business data.
- [ ] Decide whether the membership-management and password-reset gaps above need to close
      before this specific customer's pilot, or can wait.

## Before wider internet exposure (beyond one pilot customer)

- [ ] Build the in-app membership management UI (closes the biggest PARTIAL above).
- [ ] Consider Postgres RLS as a second, independent tenant-isolation layer.
- [ ] Consider a proper email-based password reset and (if ever needed) invite flow.
- [ ] Re-run `npm audit`/`npm outdated` and apply the dev-tooling major-version bumps
      deferred in this phase.
- [ ] Commission an independent security review before scaling beyond a small number of
      trusted pilot customers.

## Adversarial review (performed this session)

| Question | Result |
| --- | --- |
| Modify the URL to access another company's data? | Denied — resolves to "not found" (`src/server/tenancy.test.ts`) |
| Call a Server Action directly, bypassing UI? | Every mutating action independently checks `requireOrgContext(permission)`; UI has no bearing on enforcement |
| Submit another `organizationId`? | No validation schema anywhere accepts one (verified by grep across `src/server/validation/*.ts`) |
| Submit myself as OWNER? | No client input ever sets a role; roles come only from the `organization_memberships` table, written only by the CLI script |
| Fake a transaction total or net weight? | Both always recomputed server-side (`settleWeighing`/`valueOfQuantityCts`); no schema accepts either field from a client |
| Complete a ticket twice concurrently? | Prevented by a `FOR UPDATE` row lock; verified under genuine concurrent calls (`src/server/use-cases/concurrency.test.ts`) |
| Access business data without logging in? | `src/proxy.ts` redirects for UX; `getOrgContext()` in the workspace layout enforces it for real, ahead of every page in the tree |
| Can VIEWER mutate data? | No — verified live: provisioned a VIEWER account (`npm run db:create-user --role=VIEWER`), signed in as it in a real browser, filled and submitted the new-weighing form. The submission was rejected and a direct database check confirmed zero rows were written (`SELECT ... FROM weighing_tickets WHERE plate_snapshot LIKE '%999999%'` → 0 rows), consistent with `requireOrgContext` denying `OPERATE_WEIGHING` to VIEWER (also unit-tested in `authorization.test.ts`). Note: the UI does not yet hide controls a VIEWER can't use (e.g. the "Nouvelle pesée" button is still visible) — enforcement is real and server-side, but the affordance is misleading; a reasonable follow-up. |
| Can OPERATOR manage members? | N/A today — no member-management feature exists yet (see Authorization gap) |
| Trigger demo reset in production? | Refused before authentication is even checked (`serverEnv().NODE_ENV === "production"` guard, first line of `resetDemoAction`) |
| Exception reveals SQL/env details? | No — `error.tsx` only shows allow-listed safe messages |
| Script-like supplier notes execute? | No injection point exists (no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere in `src/`, verified by grep); not independently re-verified by submitting a live XSS payload through the UI in this pass |
| Secrets in Git history? | None found (working tree + full history scanned for common credential patterns) |
| Secrets reach the browser bundle? | No `NEXT_PUBLIC_*` variables exist in the app |
| CI leaks repository/production secrets? | No secrets are defined in the repository at all |
| Failed transaction partially modifies stock? | No — verified by `src/db/integrity.test.ts`'s rollback test |

One item above (live XSS payload submission through the UI) was checked at the
code-review level (no injection point exists anywhere in `src/`) but not re-verified by
actually submitting a script-like payload through a form in a live session, for remaining
session time. Recommended as a quick follow-up, not a known failure.
