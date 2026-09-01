/**
 * Throwaway database for use-case tests: real schema (migrations applied), minimal fixture.
 * A temporary file is used rather than `:memory:` because libsql opens a dedicated connection
 * per transaction, and separate connections never share an in-memory database.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDatabase, type Database } from "./client";
import { runMigrations } from "./migrate";
import { materialPrices, materials, organizations, suppliers, yards } from "./schema";

export interface TestFixture {
  db: Database;
  close: () => void;
  organizationId: string;
  yardId: string;
  supplierId: string;
  inactiveSupplierId: string;
  copperId: string;
  steelId: string;
  inactiveMaterialId: string;
}

export async function createTestDatabase(): Promise<TestFixture> {
  const dir = mkdtempSync(path.join(tmpdir(), "matiere-test-"));
  const { db, client } = await createDatabase(`file:${path.join(dir, "test.db")}`);
  await runMigrations(db);

  const organizationId = randomUUID();
  const yardId = randomUUID();
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
      materialId: copperId,
      purchasePriceCtsPerT: 615_000,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    },
    {
      id: randomUUID(),
      materialId: steelId,
      purchasePriceCtsPerT: 18_500,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    },
  ]);

  return {
    db,
    close: () => {
      client.close();
      rmSync(dir, { recursive: true, force: true });
    },
    organizationId,
    yardId,
    supplierId,
    inactiveSupplierId,
    copperId,
    steelId,
    inactiveMaterialId,
  };
}
