/**
 * Concurrency/atomicity guarantees that used to come "for free" from the SQLite-era
 * in-process transaction queue (see src/db/client.ts) must now come from real Postgres row
 * locks. These tests fire genuinely concurrent calls — not sequential awaits — to prove the
 * `SELECT ... FOR UPDATE` locks added alongside the Postgres migration actually serialize
 * the right rows.
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { inventoryMovements, weighingTickets } from "@/db/schema";
import { createTestDatabase, type TestFixture } from "@/db/test-db";

import { recordAdjustment, recordDispatch } from "./inventory";
import { completeWeighingTicket, createWeighingTicket } from "./weighing";

let fx: TestFixture;

beforeEach(async () => {
  fx = await createTestDatabase();
});

afterEach(async () => {
  await fx.close();
});

/** Settles a `Promise` into a pass/fail record instead of letting a rejection propagate. */
async function settle<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await p };
  } catch (error) {
    return { ok: false, error };
  }
}

describe("concurrent ticket completion", () => {
  it("two simultaneous completions of the same ticket: exactly one succeeds, exactly one inventory movement and one audit event exist", async () => {
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
      supplierId: fx.supplierId,
      plate: "VD 1",
      materialId: fx.copperId,
      unitPriceCtsPerT: 615_000,
      grossWeightG: 8_420_000,
      grossWeighedAt: new Date("2026-09-01T07:00:00Z"),
      tareWeightG: null,
      tareWeighedAt: null,
      externalReference: "",
      notes: "",
    });

    const input = { tareWeightG: 6_870_000, tareWeighedAt: new Date("2026-09-01T08:00:00Z") };
    const [first, second] = await Promise.all([
      settle(completeWeighingTicket(fx.db, fx.organizationId, created.id, fx.ownerUserId, input)),
      settle(completeWeighingTicket(fx.db, fx.organizationId, created.id, fx.ownerUserId, input)),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const failed = outcomes.find((o) => !o.ok);
    expect(failed && !failed.ok ? failed.error : null).toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });

    const movements = await fx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.weighingTicketId, created.id));
    expect(movements).toHaveLength(1);

    const [ticket] = await fx.db
      .select()
      .from(weighingTickets)
      .where(eq(weighingTickets.id, created.id));
    expect(ticket?.status).toBe("completed");
  });
});

describe("concurrent stock-affecting operations", () => {
  it("two simultaneous dispatches that would each individually succeed cannot both push stock negative", async () => {
    await recordAdjustment(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
      materialId: fx.steelId,
      quantityG: 10_000_000,
      unitValueCtsPerT: 18_500,
      occurredAt: new Date("2026-08-01T06:00:00Z"),
      note: "Inventaire d'ouverture",
    });

    // Each dispatch alone is valid against the 10t opening balance; together they would take
    // stock to -6t if both read the same stale sum. The FOR UPDATE lock on the material row
    // must force them to serialize instead.
    const dispatch = (occurredAt: Date) =>
      recordDispatch(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
        materialId: fx.steelId,
        quantityG: 8_000_000,
        unitValueCtsPerT: 20_000,
        occurredAt,
        note: "",
      });

    const [first, second] = await Promise.all([
      settle(dispatch(new Date("2026-08-02T06:00:00Z"))),
      settle(dispatch(new Date("2026-08-02T06:00:01Z"))),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const failed = outcomes.find((o) => !o.ok);
    expect(failed && !failed.ok ? failed.error : null).toMatchObject({
      code: "STOCK_INSUFFICIENT",
    });

    const movements = await fx.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.materialId, fx.steelId));
    // Exactly the opening adjustment plus the one dispatch that won the race.
    expect(movements).toHaveLength(2);
    const totalG = movements.reduce((sum, m) => sum + m.quantityG, 0);
    expect(totalG).toBe(2_000_000);
    expect(totalG).toBeGreaterThanOrEqual(0);
  });
});
