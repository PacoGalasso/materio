# MATIÈRE — working notes for AI agents

Operations software for scrap-metal / recycling yards (Swiss market, French UI). V1 is a
local, single-workspace product: arrival → gross weighing → material → tare → net → price →
stock → traceability → dashboard.

## Commands

```
npm install            # deps (libsql ships prebuilt binaries; no native build needed)
npm run db:setup       # migrate + seed the local SQLite file (data/matiere.db)
npm run dev            # http://localhost:3000
npm run typecheck | lint | test | test:e2e | build
npm run db:generate    # after editing src/db/schema.ts → new SQL in drizzle/
```

Next.js allows one `next dev` per project directory: stop it before `npm run test:e2e`
(the suite starts its own server on port 3100 with its own database `data/e2e.db`).

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts` conventions, async `params`), React 19,
TypeScript strict, Tailwind CSS v4 (CSS-first tokens in `src/app/globals.css`),
Drizzle ORM + `@libsql/client` (SQLite file), Zod 4, lucide-react, Vitest, Playwright.
Read `node_modules/next/dist/docs/` before using a Next API you are unsure about.

## Architecture (modular monolith)

```
src/app/(workspace)/*      routes (server components; `dynamic = "force-dynamic"`)
src/components/*           ui primitives (ui/), feature components; client islands only when needed
src/server/actions/*       "use server" entry points: parse FormData → use case → ActionResult
src/server/validation/*    Zod schemas + Swiss number/date parsing (server-side, always)
src/server/use-cases/*     application layer: transactions, invariants, per organization
src/server/queries/*       read models (joins, aggregates); no N+1
src/domain/*               pure business rules, no DB/React (weights, prices, status, inventory)
src/db/*                   schema, client, migrations, seed
src/lib/format.ts          the ONLY place that formats CHF / kg / dates
```

Every write goes through `withTransaction(db, …)` from `src/db/client.ts` (it re-applies
`PRAGMA foreign_keys` because libsql opens a new connection after each transaction).
`getWorkspace()` in `src/server/context.ts` is the future auth/tenancy seam.

## Domain terminology

WeighingTicket (pesée), Supplier (fournisseur), Vehicle (plaque), Material (matière),
MaterialPrice (prix d'achat), InventoryMovement (mouvement de stock: receipt / dispatch /
adjustment), Yard (site), Organization. Statuses: open → completed | cancelled.

## Critical business rules

- Weights are integer **grams**; money is integer **CHF centimes**; unit prices are integer
  **centimes per tonne**. `priceUnit` (kg | t) is display/input only, never storage.
- `net = gross − tare`; total = `net × price / 1'000'000` rounded half-up (see `src/domain/units.ts`).
- A ticket completes only with supplier, material, plate, gross, tare < gross, net > 0, price ≥ 0.
- Completion creates exactly one `receipt` movement in the same transaction. Stock = SUM of
  signed movements (no denormalized stock table). Completed tickets are immutable in V1.
- References `P-YYYY-NNNNN` come from an organization counter allocated inside the transaction.
- Never parse numbers with `parseFloat`: use `parseScaledDecimal` / `parseUnitPrice`.

## Conventions

- Code, identifiers and docs in English; UI copy in professional Swiss French.
- Swiss formats: `CHF 9'532.50`, `1'550 kg`, `12.4 t`, `01.09.2026`, `14:42` (Europe/Zurich).
- No `any`; no lint rule disabling to get green; keep components small; server components by default.
- Colour never carries meaning alone (status badges have icons + text).
- Tests: domain rules in `src/domain/*.test.ts`, use cases against a throwaway SQLite file
  (`src/db/test-db.ts`), critical flows in `e2e/`. No snapshot tests.
