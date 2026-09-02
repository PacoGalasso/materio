/**
 * IDOR/BOLA regression suite: organization A must never be able to read or mutate
 * organization B's data by supplying B's id while authenticated as A. Every query/use-case
 * here is called exactly as a server action would call it — with A's own organizationId and
 * a ticket/supplier/material/etc id taken from B — which is exactly the shape of an attacker
 * simply editing an id in a request. Expected outcome throughout: "not found", the same as
 * for an id that doesn't exist at all, never a distinguishable error and never real data.
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditEvents, inventoryMovements } from "@/db/schema";
import { createTestDatabase, type TestFixture } from "@/db/test-db";
import { DomainError } from "@/domain/errors";

import { getMaterialStockG, listMovements } from "./queries/inventory";
import { getMaterial, getMaterialActivity, listPriceHistory } from "./queries/materials";
import { getSupplier, getSupplierActivity, listSupplierVehicles } from "./queries/suppliers";
import { getTicketDetail, listTickets } from "./queries/tickets";
import { recordAdjustment, recordDispatch } from "./use-cases/inventory";
import { updateMaterial, updateMaterialPrice } from "./use-cases/materials";
import { removeSupplierVehicle, updateSupplier } from "./use-cases/suppliers";
import {
  cancelWeighingTicket,
  completeWeighingTicket,
  createWeighingTicket,
} from "./use-cases/weighing";

let a: TestFixture;
let b: TestFixture;

beforeEach(async () => {
  [a, b] = await Promise.all([createTestDatabase(), createTestDatabase()]);
});

afterEach(async () => {
  await Promise.all([a.close(), b.close()]);
});

describe("cross-tenant reads (queries)", () => {
  it("cannot read another organization's material by id", async () => {
    expect(await getMaterial(a.organizationId, b.copperId)).toBeNull();
  });

  it("cannot read another organization's supplier by id", async () => {
    expect(await getSupplier(a.organizationId, b.supplierId)).toBeNull();
  });

  it("cannot read another organization's material price history, activity or stock", async () => {
    expect(await listPriceHistory(a.organizationId, b.copperId)).toEqual([]);
    expect(await getMaterialActivity(a.organizationId, b.copperId)).toMatchObject({
      receivedLast30dG: 0,
      receiptsLast30d: 0,
    });
    expect(await getMaterialStockG(a.organizationId, b.copperId)).toBe(0);
  });

  it("cannot read another organization's supplier activity or vehicles", async () => {
    expect(await getSupplierActivity(a.organizationId, b.supplierId)).toMatchObject({
      ticketCount: 0,
      totalReceivedG: 0,
    });
    expect(await listSupplierVehicles(a.organizationId, b.supplierId)).toEqual([]);
  });

  it("cannot read another organization's inventory movements by material filter", async () => {
    expect(await listMovements(a.organizationId, { materialId: b.copperId })).toEqual([]);
  });

  it("cannot read another organization's weighing ticket, even in a shared list filter", async () => {
    const created = await createWeighingTicket(b.db, b.organizationId, b.yardId, b.ownerUserId, {
      supplierId: b.supplierId,
      plate: "VD 1",
      materialId: b.copperId,
      unitPriceCtsPerT: 615_000,
      grossWeightG: 1_000_000,
      grossWeighedAt: new Date(),
      tareWeightG: 400_000,
      tareWeighedAt: new Date(),
      externalReference: "",
      notes: "",
    });
    expect(await getTicketDetail(a.organizationId, created.id)).toBeNull();
    const list = await listTickets(a.organizationId, { supplierId: b.supplierId });
    expect(list.rows).toHaveLength(0);
    expect(list.total).toBe(0);
  });
});

describe("cross-tenant writes (use cases)", () => {
  it("cannot create a weighing ticket against another organization's supplier or material", async () => {
    await expect(
      createWeighingTicket(a.db, a.organizationId, a.yardId, a.ownerUserId, {
        supplierId: b.supplierId,
        plate: "VD 1",
        materialId: a.copperId,
        unitPriceCtsPerT: 615_000,
        grossWeightG: 1_000_000,
        grossWeighedAt: new Date(),
        tareWeightG: null,
        tareWeighedAt: null,
        externalReference: "",
        notes: "",
      }),
    ).rejects.toMatchObject({ code: "SUPPLIER_NOT_FOUND" });

    await expect(
      createWeighingTicket(a.db, a.organizationId, a.yardId, a.ownerUserId, {
        supplierId: a.supplierId,
        plate: "VD 1",
        materialId: b.copperId,
        unitPriceCtsPerT: 615_000,
        grossWeightG: 1_000_000,
        grossWeighedAt: new Date(),
        tareWeightG: null,
        tareWeighedAt: null,
        externalReference: "",
        notes: "",
      }),
    ).rejects.toMatchObject({ code: "MATERIAL_NOT_FOUND" });
  });

  it("cannot complete or cancel another organization's ticket", async () => {
    const ticket = await createWeighingTicket(b.db, b.organizationId, b.yardId, b.ownerUserId, {
      supplierId: b.supplierId,
      plate: "VD 1",
      materialId: b.copperId,
      unitPriceCtsPerT: 615_000,
      grossWeightG: 1_000_000,
      grossWeighedAt: new Date(),
      tareWeightG: null,
      tareWeighedAt: null,
      externalReference: "",
      notes: "",
    });

    await expect(
      completeWeighingTicket(a.db, a.organizationId, ticket.id, a.ownerUserId, {
        tareWeightG: 400_000,
        tareWeighedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });

    await expect(
      cancelWeighingTicket(a.db, a.organizationId, ticket.id, a.ownerUserId, "attempt"),
    ).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });

    // The ticket in B is untouched.
    const stillOpen = await getTicketDetail(b.organizationId, ticket.id);
    expect(stillOpen?.ticket.status).toBe("open");
  });

  it("cannot update another organization's supplier or material", async () => {
    await expect(
      updateSupplier(a.db, a.organizationId, b.supplierId, a.ownerUserId, {
        name: "Hijacked",
        contactName: "",
        email: "",
        phone: "",
        street: "",
        postalCode: "",
        city: "",
        canton: "",
        vatNumber: "",
        notes: "",
        isActive: true,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      updateMaterial(a.db, a.organizationId, b.copperId, a.ownerUserId, {
        code: "HACK",
        name: "Hijacked",
        category: "other",
        priceUnit: "kg",
        isActive: true,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      updateMaterialPrice(a.db, a.organizationId, b.copperId, a.ownerUserId, {
        priceCtsPerT: 1,
        effectiveFrom: new Date(),
        note: "",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("removing another organization's vehicle by id is a silent no-op, never a cross-tenant delete", async () => {
    // Give B a vehicle via a completed ticket, then try to remove it as A.
    const ticket = await createWeighingTicket(b.db, b.organizationId, b.yardId, b.ownerUserId, {
      supplierId: b.supplierId,
      plate: "VD 999999",
      materialId: b.copperId,
      unitPriceCtsPerT: 615_000,
      grossWeightG: 1_000_000,
      grossWeighedAt: new Date(),
      tareWeightG: 400_000,
      tareWeighedAt: new Date(),
      externalReference: "",
      notes: "",
    });
    const detail = await getTicketDetail(b.organizationId, ticket.id);
    const vehicleId = detail?.vehicle?.id;
    expect(vehicleId).toBeTruthy();

    await removeSupplierVehicle(a.db, a.organizationId, vehicleId!);

    const stillThere = await getTicketDetail(b.organizationId, ticket.id);
    expect(stillThere?.vehicle?.id).toBe(vehicleId);
  });

  it("cannot dispatch or adjust another organization's stock", async () => {
    await expect(
      recordDispatch(a.db, a.organizationId, a.yardId, a.ownerUserId, {
        materialId: b.steelId,
        quantityG: 1,
        unitValueCtsPerT: 1,
        occurredAt: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "MATERIAL_NOT_FOUND" });

    await expect(
      recordAdjustment(a.db, a.organizationId, a.yardId, a.ownerUserId, {
        materialId: b.steelId,
        quantityG: 1,
        unitValueCtsPerT: 1,
        occurredAt: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "MATERIAL_NOT_FOUND" });

    expect(await getMaterialStockG(b.organizationId, b.steelId)).toBe(0);
  });
});

describe("audit records stay tenant-scoped", () => {
  it("a write in organization B never produces an audit row visible under organization A", async () => {
    await recordAdjustment(b.db, b.organizationId, b.yardId, b.ownerUserId, {
      materialId: b.steelId,
      quantityG: 1_000,
      unitValueCtsPerT: 1_000,
      occurredAt: new Date(),
      note: "",
    });
    const aEvents = await a.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, a.organizationId));
    expect(aEvents).toHaveLength(0);
    const bEvents = await b.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, b.organizationId));
    expect(bEvents.length).toBeGreaterThan(0);
  });
});

describe("stock sums never mix organizations", () => {
  it("two organizations' movements on materials sharing no id never leak into each other's sum", async () => {
    await recordAdjustment(a.db, a.organizationId, a.yardId, a.ownerUserId, {
      materialId: a.steelId,
      quantityG: 5_000_000,
      unitValueCtsPerT: 18_500,
      occurredAt: new Date(),
      note: "",
    });
    await recordAdjustment(b.db, b.organizationId, b.yardId, b.ownerUserId, {
      materialId: b.steelId,
      quantityG: 9_000_000,
      unitValueCtsPerT: 18_500,
      occurredAt: new Date(),
      note: "",
    });
    expect(await getMaterialStockG(a.organizationId, a.steelId)).toBe(5_000_000);
    expect(await getMaterialStockG(b.organizationId, b.steelId)).toBe(9_000_000);

    const aMovements = await a.db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.organizationId, a.organizationId));
    expect(aMovements).toHaveLength(1);
  });
});
