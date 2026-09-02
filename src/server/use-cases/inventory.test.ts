import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { materialPrices, materials } from "@/db/schema";
import { createTestDatabase, type TestFixture } from "@/db/test-db";
import { getMaterialStockG } from "@/server/queries/inventory";

import { recordAdjustment, recordDispatch } from "./inventory";
import { updateMaterialPrice } from "./materials";

let fx: TestFixture;

beforeEach(async () => {
  fx = await createTestDatabase();
  // getMaterialStockG reads through the app-wide handle; point it at the test database.
  globalThis.__matiereDatabase = { db: fx.db, pool: {} as never };
});

afterEach(async () => {
  globalThis.__matiereDatabase = undefined;
  await fx.close();
});

describe("inventory movements", () => {
  it("adjusts, dispatches and never goes below zero", async () => {
    await recordAdjustment(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
      materialId: fx.steelId,
      quantityG: 10_000_000,
      unitValueCtsPerT: 18_500,
      occurredAt: new Date("2026-08-01T06:00:00Z"),
      note: "Inventaire d'ouverture",
    });
    expect(await getMaterialStockG(fx.organizationId, fx.steelId)).toBe(10_000_000);

    await recordDispatch(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
      materialId: fx.steelId,
      quantityG: 4_000_000,
      unitValueCtsPerT: 20_000,
      occurredAt: new Date("2026-08-02T06:00:00Z"),
      note: "Aciérie",
    });
    expect(await getMaterialStockG(fx.organizationId, fx.steelId)).toBe(6_000_000);

    await expect(
      recordDispatch(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
        materialId: fx.steelId,
        quantityG: 6_000_001,
        unitValueCtsPerT: 20_000,
        occurredAt: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });

    await expect(
      recordAdjustment(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
        materialId: fx.steelId,
        quantityG: -6_000_001,
        unitValueCtsPerT: 18_500,
        occurredAt: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    expect(await getMaterialStockG(fx.organizationId, fx.steelId)).toBe(6_000_000);
  });

  it("rejects unknown materials", async () => {
    await expect(
      recordDispatch(fx.db, fx.organizationId, fx.yardId, fx.ownerUserId, {
        materialId: "00000000-0000-0000-0000-000000000000",
        quantityG: 1,
        unitValueCtsPerT: 1,
        occurredAt: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "MATERIAL_NOT_FOUND" });
  });
});

describe("updateMaterialPrice", () => {
  it("records history and updates the reference price in centimes per tonne", async () => {
    await updateMaterialPrice(fx.db, fx.organizationId, fx.copperId, fx.ownerUserId, {
      priceCtsPerT: 640_000,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      note: "Hausse marché",
    });
    const [material] = await fx.db.select().from(materials).where(eq(materials.id, fx.copperId));
    expect(material?.currentPurchasePriceCtsPerT).toBe(640_000);
    const history = await fx.db
      .select()
      .from(materialPrices)
      .where(eq(materialPrices.materialId, fx.copperId));
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.purchasePriceCtsPerT).sort()).toEqual([615_000, 640_000]);
  });

  it("refuses negative prices", async () => {
    await expect(
      updateMaterialPrice(fx.db, fx.organizationId, fx.copperId, fx.ownerUserId, {
        priceCtsPerT: -1,
        effectiveFrom: new Date(),
        note: "",
      }),
    ).rejects.toMatchObject({ code: "PRICE_NEGATIVE" });
  });
});
