import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withTransaction } from "./client";
import { inventoryMovements, materials, suppliers } from "./schema";
import { createTestDatabase, type TestFixture } from "./test-db";

let fx: TestFixture;

/** Drizzle wraps driver errors ("Failed query…"); the Postgres reason sits in the cause chain. */
function rootMessage(error: unknown): string {
  let current: unknown = error;
  const messages: string[] = [];
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages.join(" <- ");
}

async function rejectionOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return rootMessage(error);
  }
  throw new Error("Expected the promise to reject");
}

beforeEach(async () => {
  fx = await createTestDatabase();
});

afterEach(async () => {
  await fx.close();
});

describe("database integrity", () => {
  it("enforces foreign keys inside transactions, even after previous transactions", async () => {
    const insertOrphan = () =>
      withTransaction(fx.db, async (tx) => {
        await tx.insert(inventoryMovements).values({
          id: randomUUID(),
          organizationId: fx.organizationId,
          yardId: fx.yardId,
          materialId: randomUUID(),
          type: "adjustment",
          quantityG: 1000,
          unitValueCtsPerT: 1000,
          amountCts: 1,
          occurredAt: new Date(),
        });
      });

    expect(await rejectionOf(insertOrphan())).toMatch(/FOREIGN KEY/i);
    // A valid transaction in between must not weaken enforcement for the next one.
    await withTransaction(fx.db, async (tx) => {
      await tx
        .insert(suppliers)
        .values({ id: randomUUID(), organizationId: fx.organizationId, name: "OK Sàrl" });
    });
    expect(await rejectionOf(insertOrphan())).toMatch(/FOREIGN KEY/i);
    // Every fixture shares one Postgres database (see src/db/test-db.ts), so this must scope
    // to this fixture's own organization rather than counting every row in the table.
    expect(
      await fx.db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.organizationId, fx.organizationId)),
    ).toHaveLength(0);
  });

  it("rejects negative prices at the database level", async () => {
    const message = await rejectionOf(
      withTransaction(fx.db, async (tx) => {
        await tx.insert(materials).values({
          id: randomUUID(),
          organizationId: fx.organizationId,
          code: "NEG",
          name: "Négatif",
          category: "other",
          currentPurchasePriceCtsPerT: -1,
        });
      }),
    );
    expect(message).toMatch(/violates check constraint/i);
  });

  it("rolls back the whole transaction on failure", async () => {
    await expect(
      withTransaction(fx.db, async (tx) => {
        await tx
          .insert(suppliers)
          .values({ id: randomUUID(), organizationId: fx.organizationId, name: "Partiel" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await fx.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.organizationId, fx.organizationId));
    expect(rows.map((row) => row.name)).not.toContain("Partiel");
  });
});
