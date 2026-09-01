# MATIÈRE

**Operations intelligence for material recovery.**

MATIÈRE is operations software for recycling and scrap-metal yards. This repository contains
the first production-quality **local V1**: a single demo workspace (RecycLéman SA,
Yverdon-les-Bains) that covers the core operating flow of a weighbridge:

vehicle arrival → gross weighing → material reception → tare weighing → net weight →
price calculation → stock update → transaction traceability → operational dashboard.

The interface is in Swiss French; code and documentation are in English.

## Stack

| Layer       | Choice                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| Framework   | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict          |
| Styling     | Tailwind CSS v4 with CSS design tokens, self-hosted IBM Plex Sans / Mono |
| Persistence | SQLite file via `@libsql/client`, Drizzle ORM + drizzle-kit migrations   |
| Validation  | Zod 4 + exact decimal parsing (no floating point for money or weights)   |
| Tests       | Vitest (domain + use cases), Playwright (critical end-to-end flows)      |
| Icons       | lucide-react                                                             |

Runtime dependencies are deliberately few: `next`, `react`, `react-dom`, `drizzle-orm`,
`@libsql/client`, `zod`, `lucide-react`.

## Prerequisites

- Node.js **22** or newer (`node --version`)
- npm 10 (bundled with Node)
- For end-to-end tests only: `npx playwright install chromium` once

No database server, no API keys, no external accounts.

## Local setup

```bash
git clone <this repository> matiere
cd matiere
npm install
npm run db:setup     # creates data/matiere.db, applies migrations, seeds the demo workspace
npm run dev          # http://localhost:3000
```

You land directly in the populated workspace. Data persists in `data/matiere.db` across
reloads and restarts.

### Environment variables

Copying `.env.example` to `.env` is optional; every value has a default.

| Variable       | Default                  | Purpose                           |
| -------------- | ------------------------ | --------------------------------- |
| `DATABASE_URL` | `file:./data/matiere.db` | libsql URL of the SQLite database |

### Commands

| Command                       | What it does                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                               |
| `npm run build` / `npm start` | Production build / server                                                        |
| `npm run typecheck`           | `tsc --noEmit`                                                                   |
| `npm run lint`                | ESLint (flat config, Next.js + TypeScript rules)                                 |
| `npm test`                    | Vitest: domain rules, use cases, database integrity                              |
| `npm run test:e2e`            | Playwright: weighing workflow on a dedicated database (`data/e2e.db`, port 3100) |
| `npm run db:migrate`          | Apply pending migrations from `drizzle/`                                         |
| `npm run db:seed`             | Rebuild the demo dataset (also available from _Paramètres_ in the app)           |
| `npm run db:setup`            | `db:migrate` + `db:seed`                                                         |
| `npm run db:generate`         | Generate a migration after editing `src/db/schema.ts`                            |
| `npm run check`               | typecheck + lint + test + build                                                  |

Next.js allows a single `next dev` per project directory: stop your dev server before
running `npm run test:e2e` (the suite starts its own).

## Product scope (V1)

| Route                                 | Screen                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | **Tableau de bord** — today's receipts and purchases, dispatched tonnage, estimated stock value, pending weighings, stock value by material, 14-day activity, recent transactions                                           |
| `/pesees/nouvelle`                    | **Nouvelle pesée** — the hero workflow: supplier (searchable, inline creation), plate with known vehicles, material with reference price, gross, optional tare, live net/value, keyboard-first (`N` opens it from anywhere) |
| `/pesees`                             | **Pesées** — searchable, filterable, sortable, paginated ticket table                                                                                                                                                       |
| `/pesees/[id]`                        | **Bulletin de pesée** — printable transaction record; tare entry and completion for open tickets; cancellation                                                                                                              |
| `/stock`                              | **Stock** — quantity, reference price, estimated value, 7-day movement, last movement per material; recent movements                                                                                                        |
| `/matieres`, `/matieres/[id]`         | **Matières** — material catalogue, purchase price update with history, stock movements, dispatch (shipment) and inventory correction                                                                                        |
| `/fournisseurs`, `/fournisseurs/[id]` | **Fournisseurs** — directory with activity, detail with vehicles and ticket history, creation and edition                                                                                                                   |
| `/parametres`                         | **Paramètres** — company, yard, conventions, demo data reset                                                                                                                                                                |

## Architecture

A modular monolith with explicit layers:

```
UI (src/app, src/components)
  → server actions (src/server/actions)      parse FormData with Zod, return typed results
  → use cases (src/server/use-cases)         transactions, invariants, per organization
  → domain rules (src/domain)                pure TypeScript, unit-tested
  → persistence (src/db)                     Drizzle schema, migrations, seed
```

Read models live in `src/server/queries` (joins and aggregates, no N+1). Swiss formatting
lives only in `src/lib/format.ts`. `src/server/context.ts` resolves the single demo
workspace and is the seam where authentication and organization tenancy will plug in.

### Key domain rules

- **Units**: weights are integer grams, money is integer CHF centimes, unit prices are
  integer centimes per tonne. The `kg` / `t` price unit of a material only changes how a
  price is typed and displayed. No floating point touches money or weights; operator input
  is parsed exactly (`8'420.5`, `6,15`, `185`).
- **Net weight** = gross − tare; the tare can never exceed the gross and the net must be > 0.
- **Value** = net × unit price ÷ 1'000'000, rounded half-up to the centime.
- **Completion** requires supplier, material, plate, gross, tare and price. It books exactly
  one `receipt` inventory movement in the same transaction; stock is the signed sum of
  movements. Completed tickets are immutable.
- **References** (`P-2026-00042`) are allocated from an organization counter inside the
  creation transaction.
- Foreign keys and check constraints are enforced on every write (see `withTransaction`).

### Database

Schema in `src/db/schema.ts`; SQL migrations in `drizzle/`. Tables: `organizations`,
`yards`, `suppliers`, `vehicles`, `materials`, `material_prices`, `weighing_tickets`,
`inventory_movements`. Timestamps are epoch milliseconds rendered in Europe/Zurich.

Migrating to PostgreSQL later means swapping the Drizzle dialect (`sqlite-core` →
`pg-core`) and the driver in `src/db/client.ts`; use cases and queries are dialect-agnostic
Drizzle code.

## Demo data

`npm run db:setup` (or the reset button in _Paramètres_) generates a deterministic,
internally consistent dataset relative to today: 12 materials with **demo prices**
(not market quotations), 12 fictional Swiss-romand suppliers with vehicles, about 60
weighings over three weeks (a few still awaiting their tare, two cancelled), opening
balances and shipments. All figures pass through the domain functions, so tickets,
movements and stock always agree. Every company, person and plate is invented.

## Testing

```bash
npm test          # 66 tests: units, rounding, status transitions, inventory, use cases, DB integrity
npm run test:e2e  # 6 flows: one-pass weighing, arrival then tare, invalid values, price update,
                  #          shipment with over-shipping refused, quick supplier + cancellation
```

## Limitations of this local V1

- Single workspace, no authentication, no user accounts: **do not expose it on the Internet**.
- One material per weighing ticket (mixed loads need several tickets).
- Completed tickets cannot be corrected or cancelled (create a new one).
- Shipments ("expéditions") are recorded per material from the material page; there is no
  customer/sales ticket flow.
- Printing uses the browser's print dialog (print stylesheet); no PDF generation.
- Photos/attachments are not stored.
- SQLite is a single-process store; fine locally, not for a multi-site deployment.

### Before an Internet deployment

Authentication and organization tenancy (`getWorkspace` seam), authorization on every
server action, CSRF/origin checks beyond Next.js defaults, rate limiting, PostgreSQL with
backups, audit log, secrets management, security headers, dependency auditing in CI.

## Recommended roadmap

1. Accounts and organizations (auth + tenancy), roles (operator, manager, owner).
2. Multi-line tickets, corrections with reversing movements, PDF receipts with signature.
3. Weighbridge integration (serial/IP scale), plate recognition, supplier statements and
   payments, PostgreSQL deployment.

## License note on fonts

IBM Plex is distributed under the SIL Open Font License (see `src/app/fonts/LICENSE.txt`).
