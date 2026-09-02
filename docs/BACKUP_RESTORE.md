# Backup & Restore

This describes the intended backup strategy for a production deployment. **No backup
infrastructure has actually been provisioned in this phase** — this is a specification for
whoever operates the production database, not a claim that it's already running.

## What needs backing up

Everything lives in one PostgreSQL database: `organizations`, memberships, business tables
(suppliers, materials, weighing tickets, inventory movements, audit events), and Better
Auth's own tables (`user`, `session`, `account`, `verification`, `rate_limit`). There is no
separate object/file store in V1 (no attachments/photos).

## Recommended approach

Use your managed Postgres provider's built-in backup feature rather than a hand-rolled
`pg_dump` cron job — virtually every reputable managed Postgres offering (the kind this app
should run against in production; see `docs/DEPLOYMENT.md`) includes:

- **Automatic daily full backups**, retained on a rolling window (recommend **≥ 14 days**
  for a financial/operational system like this one; confirm against your provider's
  options).
- **Point-in-time recovery (PITR)** via continuous WAL archiving, letting you restore to any
  point within the retention window, not just to the moment of the last daily snapshot.
- **Encryption at rest** for stored backups — confirm this is enabled by default with your
  provider; if not, it must be turned on explicitly before real customer data is stored.

## Recovery targets

| Metric | Target | Rationale |
| --- | --- | --- |
| **RPO** (Recovery Point Objective) | ≤ 5 minutes | PITR via WAL, not just daily snapshots — a weighbridge losing more than a few minutes of tickets mid-shift is a real operational problem. |
| **RTO** (Recovery Time Objective) | ≤ 1 hour | Restoring a single-database Postgres instance from a managed provider's backup is typically a low-tens-of-minutes operation; budget the extra time for DNS/connection-string cutover and app redeploy. |

These are targets to configure against, not measured guarantees — they must be validated by
an actual restore test (see below) before being relied on.

## Restore process (managed provider — typical shape)

1. In the provider's console/CLI, create a new database instance from the desired backup or
   PITR timestamp. Do this as a **new** instance, not an in-place restore over the live one,
   so the current (possibly-corrupted) database is never destroyed before the restore is
   confirmed good.
2. Point a **staging** copy of the app at the restored instance's connection string
   (`DATABASE_URL`) and run the application's normal startup — no destructive migration
   command is ever run against a restored database beyond the same `npm run db:migrate` used
   in normal deployment (see `docs/DEPLOYMENT.md`); it is idempotent against an
   already-current schema.
3. Spot-check: sign in, confirm the dashboard and a handful of recent tickets look right for
   the restored point in time.
4. Only once confirmed: repoint the production `DATABASE_URL` at the restored instance (or
   restore in place, per your provider's supported flow) and redeploy the app.

## Local/manual restore (no managed provider — smaller/self-hosted deployments)

```bash
# Backup (run against production, from a host with network access and the pg client tools —
# never store the resulting file unencrypted anywhere reachable from the public internet):
pg_dump "$DATABASE_URL" --format=custom --file=matiere-$(date +%Y%m%d-%H%M).dump

# Restore into a fresh, empty database:
createdb matiere_restored
pg_restore --dbname=matiere_restored --clean --if-exists matiere-20260901-0800.dump
```

Encrypt the dump file at rest (e.g. `gpg --encrypt`) before it leaves the database host, and
store it somewhere with its own access control — a `pg_dump` file is a full copy of every
customer's business data and every password hash.

## Backup access control

Whoever can read a backup can read every organization's complete business data and every
password hash in the system (scrypt-hashed, not plaintext, but still credential material).
Treat backup storage access as at least as sensitive as production database access — same
principle of least privilege, same audit trail for who accessed a backup and when.

## Testing the restore process

A backup that has never been restored is unverified. **Before onboarding a first real
customer**, actually perform the "local/manual restore" steps above (or the managed-provider
equivalent) against a throwaway instance and confirm the app runs correctly against the
result. Repeat this periodically (e.g. quarterly) — backup tooling and schemas both drift
over time, and a restore that worked once is not guaranteed to keep working silently.

## What this phase did NOT do

- No backup schedule has actually been configured against any real database (there is no
  production database yet).
- No restore has actually been performed and verified end-to-end in this session — the
  process above is a specification, not a tested runbook.
- No specific managed-provider choice has been made; `docs/DEPLOYMENT.md` discusses the
  general shape without committing to one, since that's a deployment decision the team
  should make deliberately.
