/**
 * Fixture for use-case/integration tests: connects to the dedicated `matiere_test` Postgres
 * database (migrated once by Vitest's `globalSetup`, see `./test-global-setup.ts`) and inserts
 * a self-contained set of rows scoped to a fresh `organizationId`. Isolation between tests
 * (including tests running in parallel workers) comes from that fresh id, not from a
 * separate schema or database per test — every query in the app is already tenant-scoped,
 * so unrelated fixtures never interfere. `close()` deletes everything it inserted.
 */
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { createDatabase, type Database } from "./client";
import {
  materialPrices,
  materials,
  organizationMemberships,
  organizations,
  suppliers,
  user,
  yards,
} from "./schema";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://matiere:matiere@localhost:55432/matiere_test";

export interface TestFixture {
  db: Database;
  close: () => Promise<void>;
  organizationId: string;
  yardId: string;
  /** OWNER member of `organizationId`; use as the `actorUserId` for use-case calls. */
  ownerUserId: string;
  supplierId: string;
  inactiveSupplierId: string;
  copperId: string;
  steelId: string;
  inactiveMaterialId: string;
}

export async function createTestDatabase(): Promise<TestFixture> {
  const { db, pool } = createDatabase(TEST_DATABASE_URL);

  const organizationId = randomUUID();
  const yardId = randomUUID();
  const ownerUserId = randomUUID();
  const supplierId = randomUUID();
  const inactiveSupplierId = randomUUID();
  const copperId = randomUUID();
  const steelId = randomUUID();
  const inactiveMaterialId = randomUUID();

  await db.insert(organizations).values({
    id: organizationId,
    name: "Test SA",
    legalName: "Test SA",
    ticketPrefix: "P",
    nextTicketNumber: 1,
  });
  await db.insert(user).values({
    id: ownerUserId,
    name: "Test Owner",
    email: `${ownerUserId}@test.matiere.invalid`,
    emailVerified: true,
  });
  await db
    .insert(organizationMemberships)
    .values({ id: randomUUID(), organizationId, userId: ownerUserId, role: "OWNER" });
  await db
    .insert(yards)
    .values({ id: yardId, organizationId, name: "Site test", code: "TST", isDefault: true });
  await db.insert(suppliers).values([
    { id: supplierId, organizationId, name: "Construction Favre SA", city: "Lausanne" },
    { id: inactiveSupplierId, organizationId, name: "Ancien fournisseur", isActive: false },
  ]);
  await db.insert(materials).values([
    {
      id: copperId,
      organizationId,
      code: "CU-MIX",
      name: "Cuivre mêlé",
      category: "non_ferrous",
      priceUnit: "kg",
      currentPurchasePriceCtsPerT: 615_000,
      sortOrder: 0,
    },
    {
      id: steelId,
      organizationId,
      code: "FER",
      name: "Ferraille",
      category: "ferrous",
      priceUnit: "t",
      currentPurchasePriceCtsPerT: 18_500,
      sortOrder: 1,
    },
    {
      id: inactiveMaterialId,
      organizationId,
      code: "OLD",
      name: "Matière retirée",
      category: "other",
      priceUnit: "kg",
      currentPurchasePriceCtsPerT: 10_000,
      isActive: false,
      sortOrder: 2,
    },
  ]);
  await db.insert(materialPrices).values([
    {
      id: randomUUID(),
      organizationId,
      materialId: copperId,
      purchasePriceCtsPerT: 615_000,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    },
    {
      id: randomUUID(),
      organizationId,
      materialId: steelId,
      purchasePriceCtsPerT: 18_500,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    },
  ]);

  return {
    db,
    close: async () => {
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      await db.delete(user).where(inArray(user.id, [ownerUserId]));
      await pool.end();
    },
    organizationId,
    yardId,
    ownerUserId,
    supplierId,
    inactiveSupplierId,
    copperId,
    steelId,
    inactiveMaterialId,
  };
}
