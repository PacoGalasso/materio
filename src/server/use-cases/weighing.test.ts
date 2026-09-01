import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { inventoryMovements, weighingTickets } from "@/db/schema";
import { createTestDatabase, type TestFixture } from "@/db/test-db";

import {
  cancelWeighingTicket,
  completeWeighingTicket,
  createWeighingTicket,
  type CreateWeighingInput,
} from "./weighing";

let fx: TestFixture;

beforeEach(async () => {
  fx = await createTestDatabase();
});

afterEach(() => {
  fx.close();
});

function arrival(overrides: Partial<CreateWeighingInput> = {}): CreateWeighingInput {
  return {
    supplierId: fx.supplierId,
    plate: "vd 123456",
    materialId: fx.copperId,
    unitPriceCtsPerT: 615_000,
    grossWeightG: 8_420_000,
    grossWeighedAt: new Date("2026-09-01T07:15:00Z"),
    tareWeightG: null,
    tareWeighedAt: null,
    externalReference: "",
    notes: "",
    ...overrides,
  };
}

async function movementsOf(ticketId: string) {
  return fx.db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.weighingTicketId, ticketId));
}

describe("createWeighingTicket", () => {
  it("creates an open ticket with a sequential reference and no inventory movement", async () => {
    const first = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    const second = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ plate: "GE 1" }),
    );
    expect(first).toMatchObject({ reference: "P-2026-00001", status: "open" });
    expect(second.reference).toBe("P-2026-00002");

    const [ticket] = await fx.db
      .select()
      .from(weighingTickets)
      .where(eq(weighingTickets.id, first.id));
    expect(ticket).toMatchObject({
      status: "open",
      plateSnapshot: "VD 123 456",
      netWeightG: null,
      totalAmountCts: null,
      completedAt: null,
    });
    expect(ticket?.vehicleId).toBeTruthy();
    expect(await movementsOf(first.id)).toHaveLength(0);
  });

  it("completes immediately when the tare is known and books the receipt", async () => {
    const result = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ tareWeightG: 6_870_000, tareWeighedAt: new Date("2026-09-01T08:00:00Z") }),
    );
    expect(result.status).toBe("completed");
    const [ticket] = await fx.db
      .select()
      .from(weighingTickets)
      .where(eq(weighingTickets.id, result.id));
    expect(ticket).toMatchObject({
      status: "completed",
      netWeightG: 1_550_000,
      totalAmountCts: 953_250,
    });
    const movements = await movementsOf(result.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "receipt",
      materialId: fx.copperId,
      quantityG: 1_550_000,
      unitValueCtsPerT: 615_000,
      amountCts: 953_250,
    });
  });

  it("rejects a tare above the gross weight and persists nothing", async () => {
    await expect(
      createWeighingTicket(
        fx.db,
        fx.organizationId,
        fx.yardId,
        arrival({ tareWeightG: 9_000_000 }),
      ),
    ).rejects.toMatchObject({ code: "TARE_EXCEEDS_GROSS" });
    expect(await fx.db.select().from(weighingTickets)).toHaveLength(0);
    expect(await fx.db.select().from(inventoryMovements)).toHaveLength(0);
  });

  it("rejects missing or inactive supplier and material", async () => {
    await expect(
      createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival({ supplierId: "missing" })),
    ).rejects.toMatchObject({ code: "SUPPLIER_NOT_FOUND" });
    await expect(
      createWeighingTicket(
        fx.db,
        fx.organizationId,
        fx.yardId,
        arrival({ supplierId: fx.inactiveSupplierId }),
      ),
    ).rejects.toMatchObject({ code: "SUPPLIER_INACTIVE" });
    await expect(
      createWeighingTicket(
        fx.db,
        fx.organizationId,
        fx.yardId,
        arrival({ materialId: fx.inactiveMaterialId }),
      ),
    ).rejects.toMatchObject({ code: "MATERIAL_INACTIVE" });
    await expect(
      createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival({ plate: "   " })),
    ).rejects.toMatchObject({ code: "PLATE_MISSING" });
    // A failed transaction must not consume a reference number.
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    expect(created.reference).toBe("P-2026-00001");
  });

  it("reuses a known vehicle by normalized plate", async () => {
    const a = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ plate: "VD 123 456" }),
    );
    const b = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ plate: "vd-123456" }),
    );
    const rows = await fx.db.select({ vehicleId: weighingTickets.vehicleId }).from(weighingTickets);
    expect(rows.map((r) => r.vehicleId)).toEqual([rows[0]?.vehicleId, rows[0]?.vehicleId]);
    expect(a.id).not.toBe(b.id);
  });
});

describe("completeWeighingTicket", () => {
  it("settles the ticket and creates exactly one receipt movement", async () => {
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    const result = await completeWeighingTicket(fx.db, fx.organizationId, created.id, {
      tareWeightG: 6_870_000,
      tareWeighedAt: new Date("2026-09-01T08:05:00Z"),
    });
    expect(result).toMatchObject({ netWeightG: 1_550_000, totalAmountCts: 953_250 });
    const movements = await movementsOf(created.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.occurredAt.toISOString()).toBe("2026-09-01T08:05:00.000Z");
  });

  it("applies a confirmed price at completion", async () => {
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    const result = await completeWeighingTicket(fx.db, fx.organizationId, created.id, {
      tareWeightG: 6_870_000,
      tareWeighedAt: new Date("2026-09-01T08:05:00Z"),
      unitPriceCtsPerT: 620_000,
    });
    expect(result.totalAmountCts).toBe(961_000);
    const [movement] = await movementsOf(created.id);
    expect(movement?.unitValueCtsPerT).toBe(620_000);
  });

  it("cannot complete twice, nor complete a cancelled ticket", async () => {
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    await completeWeighingTicket(fx.db, fx.organizationId, created.id, {
      tareWeightG: 6_870_000,
      tareWeighedAt: new Date(),
    });
    await expect(
      completeWeighingTicket(fx.db, fx.organizationId, created.id, {
        tareWeightG: 6_000_000,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(await movementsOf(created.id)).toHaveLength(1);

    const other = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    await cancelWeighingTicket(fx.db, fx.organizationId, other.id, "");
    await expect(
      completeWeighingTicket(fx.db, fx.organizationId, other.id, {
        tareWeightG: 6_000_000,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("refuses impossible tares and leaves the ticket open", async () => {
    const created = await createWeighingTicket(fx.db, fx.organizationId, fx.yardId, arrival());
    await expect(
      completeWeighingTicket(fx.db, fx.organizationId, created.id, {
        tareWeightG: 8_420_000,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "NET_WEIGHT_ZERO" });
    await expect(
      completeWeighingTicket(fx.db, fx.organizationId, created.id, {
        tareWeightG: 9_000_000,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "TARE_EXCEEDS_GROSS" });
    const [ticket] = await fx.db
      .select()
      .from(weighingTickets)
      .where(eq(weighingTickets.id, created.id));
    expect(ticket?.status).toBe("open");
    expect(await movementsOf(created.id)).toHaveLength(0);
  });

  it("fails for an unknown ticket", async () => {
    await expect(
      completeWeighingTicket(fx.db, fx.organizationId, "nope", {
        tareWeightG: 1,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
  });
});

describe("cancelWeighingTicket", () => {
  it("cancels an open ticket and appends the reason", async () => {
    const created = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ notes: "Chargement mixte" }),
    );
    await cancelWeighingTicket(fx.db, fx.organizationId, created.id, "Matière non conforme");
    const [ticket] = await fx.db
      .select()
      .from(weighingTickets)
      .where(eq(weighingTickets.id, created.id));
    expect(ticket?.status).toBe("cancelled");
    expect(ticket?.cancelledAt).toBeInstanceOf(Date);
    expect(ticket?.notes).toBe("Chargement mixte\nAnnulation : Matière non conforme");
  });

  it("refuses to cancel a completed ticket (immutable in V1)", async () => {
    const created = await createWeighingTicket(
      fx.db,
      fx.organizationId,
      fx.yardId,
      arrival({ tareWeightG: 6_870_000 }),
    );
    await expect(
      cancelWeighingTicket(fx.db, fx.organizationId, created.id, ""),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });
});
