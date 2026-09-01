import { describe, expect, it } from "vitest";

import {
  adjustmentMovement,
  aggregateStock,
  dispatchMovement,
  receiptFromCompletedWeighing,
  stockValueCts,
  weightedAveragePriceCtsPerT,
} from "./inventory";

describe("receiptFromCompletedWeighing", () => {
  it("creates a positive receipt carrying the ticket valuation", () => {
    expect(
      receiptFromCompletedWeighing({
        netWeightG: 1_550_000,
        unitPriceCtsPerT: 615_000,
        totalAmountCts: 953_250,
      }),
    ).toEqual({
      type: "receipt",
      quantityG: 1_550_000,
      unitValueCtsPerT: 615_000,
      amountCts: 953_250,
    });
  });

  it("refuses an empty receipt", () => {
    expect(() =>
      receiptFromCompletedWeighing({ netWeightG: 0, unitPriceCtsPerT: 615_000, totalAmountCts: 0 }),
    ).toThrowError(expect.objectContaining({ code: "QUANTITY_ZERO" }));
  });
});

describe("dispatchMovement", () => {
  it("removes stock with a negative signed quantity and amount", () => {
    expect(
      dispatchMovement({
        quantityG: 2_000_000,
        unitValueCtsPerT: 25_000,
        currentStockG: 5_000_000,
      }),
    ).toEqual({
      type: "dispatch",
      quantityG: -2_000_000,
      unitValueCtsPerT: 25_000,
      amountCts: -50_000,
    });
  });

  it("cannot dispatch more than the current stock", () => {
    expect(() =>
      dispatchMovement({
        quantityG: 6_000_000,
        unitValueCtsPerT: 25_000,
        currentStockG: 5_000_000,
      }),
    ).toThrowError(expect.objectContaining({ code: "STOCK_INSUFFICIENT" }));
  });
});

describe("adjustmentMovement", () => {
  it("keeps the caller's sign", () => {
    expect(adjustmentMovement({ quantityG: -1_000, unitValueCtsPerT: 100_000 })).toEqual({
      type: "adjustment",
      quantityG: -1_000,
      unitValueCtsPerT: 100_000,
      amountCts: -100,
    });
  });
});

describe("aggregateStock", () => {
  it("sums signed quantities per material and tracks the latest movement", () => {
    const d1 = new Date("2026-08-01T10:00:00Z");
    const d2 = new Date("2026-08-02T10:00:00Z");
    const stock = aggregateStock([
      { materialId: "cu", quantityG: 1_000_000, occurredAt: d1 },
      { materialId: "cu", quantityG: -250_000, occurredAt: d2 },
      { materialId: "al", quantityG: 400_000, occurredAt: d1 },
    ]);
    expect(stock.get("cu")).toEqual({ materialId: "cu", quantityG: 750_000, lastMovementAt: d2 });
    expect(stock.get("al")).toEqual({ materialId: "al", quantityG: 400_000, lastMovementAt: d1 });
  });
});

describe("valuation", () => {
  it("values stock at the reference price", () => {
    expect(stockValueCts(12_400_000, 615_000)).toBe(7_626_000);
  });

  it("computes a weighted average purchase price", () => {
    expect(
      weightedAveragePriceCtsPerT([
        { quantityG: 1_000_000, amountCts: 600_000 }, // CHF 6.00/kg
        { quantityG: 3_000_000, amountCts: 2_100_000 }, // CHF 7.00/kg
        { quantityG: -500_000, amountCts: -400_000 }, // dispatch ignored
      ]),
    ).toBe(675_000);
    expect(weightedAveragePriceCtsPerT([])).toBeNull();
  });
});
