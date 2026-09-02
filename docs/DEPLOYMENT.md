# Deployment

Describes the intended production topology and process. **Nothing has actually been
deployed** in this phase — this is a specification for whoever operates the deployment, not
a record of a live environment.

## Topology

```
Internet
  │  HTTPS (TLS terminated here — not by this app)
  ▼
Reverse proxy / platform load balancer
  │  plain HTTP internally, with X-Forwarded-Proto: https
  ▼
Next.js app (this repository), one or more instances
  │  DATABASE_URL, private network
  ▼
Managed PostgreSQL (private network only — never exposed to the public internet)
```

The app itself never terminates TLS — that's the reverse proxy/platform's job. This matters
concretely: `src/proxy.ts` only sets `Strict-Transport-Security` when it sees
`x-forwarded-proto: https` (or a directly-HTTPS connection), specifically because the
TLS-terminating layer is expected to be in front of it. See that file's comment for the
concrete bug this design avoids (sending HSTS blindly broke local testing entirely by
getting Chrome to force-upgrade every request to a host with nothing listening on 443).

## Build

```bash
npm ci
npm run build
```

`npm run build` runs `next build`, which also runs a full TypeScript check (build fails on
type errors) — do not skip this in CI in favor of just `next build`'s own pass.

## Environment variables

All required variables are validated at startup by `src/env/server.ts` — a missing or
malformed one fails fast with a message naming the variable (never its value). See
`.env.example` for the full list and format. In summary:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Private network only. |
| `BETTER_AUTH_SECRET` | yes | ≥ 32 random characters, unique per environment. **Never reuse the dev/test value across environments.** |
| `BETTER_AUTH_URL` | yes | The app's own public origin, e.g. `https://matiere.example.com`. |
| `NODE_ENV` | effectively yes | `production` in production — controls cookie `Secure` flag, demo-reset availability, and CSP's dev-only `'unsafe-eval'` relaxation. |

No `NEXT_PUBLIC_*` variables are currently used — there is no client-exposed configuration
in this app.

## Migration sequencing

Migrations are the only supported schema-evolution mechanism — never `drizzle-kit push`
against a production database.

```bash
npm run db:migrate   # applies drizzle/*.sql in order; safe to re-run, no-op if current
```

Run this **before** starting the new app version, as a separate deploy step (not from
inside the app's own startup — the app never runs migrations automatically on boot, and must
not, so that a crash-looping app instance can never repeatedly attempt schema changes).

For a destructive-looking migration (dropping/renaming a column that's still read by the
currently-running previous version during a rolling deploy), sequence it as two deploys:
first an additive migration + application code that can read both old and new shapes, then
a follow-up migration that removes the old column once every instance is running the new
code. This project has not yet needed a destructive migration; when one is, plan it this way
rather than a single breaking change.

## Startup

```bash
npm start   # next start — serves the build produced by npm run build
```

No demo seed, no automatic migration, no destructive operation runs on startup. `npm run
db:seed` (and the in-app demo-reset control) both refuse outright when `NODE_ENV=production`
— see `src/db/seed-cli.ts` and `src/server/actions/settings.ts`.

## First-user provisioning

There is no public sign-up (`emailAndPassword.disableSignUp: true` in `src/server/auth.ts`
— a deliberate choice for private B2B software, not an oversight). Create the first
OWNER account with:

```bash
npm run db:create-user -- --email=owner@customer.example --password="..." --name="Full Name" --role=OWNER
```

Run this against the production database from a trusted operator machine/CI job with
network access to it — never expose this script as an HTTP endpoint. It is idempotent: if
the email already exists, it re-attaches that account to the target organization/role rather
than failing (this is also what lets it run safely on every CI/e2e job — see
`playwright.config.ts`).

## Health checks

- `GET /api/health` — liveness only (process is up). No auth required.
- `GET /api/ready` — liveness + a live `SELECT 1` against the database. Use this for the
  platform's readiness gate (don't route traffic to an instance until it returns 200).

Neither endpoint returns version, host, or environment detail.

## HTTPS requirement

The app must be served over HTTPS in production — full stop. Session cookies are marked
`Secure` whenever `NODE_ENV=production` (see `src/server/auth.ts`), which means they will
not be sent back by the browser at all over a plain-HTTP production deployment, breaking
sign-in silently. This is intentional: an insecure production deployment should fail loudly
by breaking auth, not quietly leak session cookies over an unencrypted connection.

## Rollback

- **Application code**: redeploy the previous build artifact/image. Stateless — no special
  handling needed as long as no migration was part of the bad deploy.
- **Database migration**: this project does not currently generate automatic "down"
  migrations. If a migration in a bad deploy needs to be undone:
  1. Roll the application back to the previous version first (so nothing is writing against
     the new/broken schema).
  2. Write and apply a new forward migration that reverses the change, rather than trying to
     "undo" the applied one — Drizzle's migration model is append-only by design, matching
     the mandate's own guidance against `db push`-style live schema mutation.
  3. For a genuinely destructive migration (a dropped column with no forward-fix), restore
     from backup instead — see `docs/BACKUP_RESTORE.md`.

## Connection pooling

`src/db/client.ts` creates one `pg.Pool` per app instance, `max: 10`. For a single-instance
deployment this is a reasonable default. If the app is ever horizontally scaled to N
instances, either:

- lower `max` proportionally so `N × max` stays under the managed Postgres provider's own
  connection limit, or
- introduce a connection pooler (e.g. PgBouncer, or the managed provider's built-in pooling
  endpoint if it offers one) between the app and Postgres, and point `DATABASE_URL` at it.

Neither has been necessary or implemented in this phase — single-instance is the assumed
target for the initial pilot.

## What this phase did NOT do

- No actual deployment, to any platform, has occurred.
- No specific hosting platform or managed Postgres provider has been chosen — this
  document describes the shape any reasonable choice should fit, not a specific one.
- No real TLS certificate, domain, or reverse proxy configuration exists.
