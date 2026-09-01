import { describe, expect, it } from "vitest";

import { DomainError } from "./errors";
import {
  checkCompletion,
  computeNetWeightG,
  computeTotalAmountCts,
  formatPlateDisplay,
  normalizePlate,
  settleWeighing,
} from "./weighing";

describe("net weight", () => {
  it("is gross minus tare", () => {
    expect(computeNetWeightG(8_420_000, 6_870_000)).toBe(1_550_000);
  });

  it("rejects a tare above the gross weight", () => {
    expect(() => computeNetWeightG(6_870_000, 8_420_000)).toThrowError(
      expect.objectContaining({ code: "TARE_EXCEEDS_GROSS" }),
    );
  });

  it("rejects negative or fractional weights", () => {
    expect(() => computeNetWeightG(-1, 0)).toThrowError(
      expect.objectContaining({ code: "WEIGHT_NEGATIVE" }),
    );
    expect(() => computeNetWeightG(10.5, 0)).toThrowError(
      expect.objectContaining({ code: "WEIGHT_NOT_INTEGER" }),
    );
  });
});

describe("total transaction value", () => {
  it("values 1'550 kg of mixed copper at CHF 6.15/kg as CHF 9'532.50", () => {
    expect(computeTotalAmountCts(1_550_000, 615_000)).toBe(953_250);
  });

  it("settles a full weighing", () => {
    expect(
      settleWeighing({
        grossWeightG: 8_420_000,
        tareWeightG: 6_870_000,
        unitPriceCtsPerT: 615_000,
      }),
    ).toEqual({
      grossWeightG: 8_420_000,
      tareWeightG: 6_870_000,
      netWeightG: 1_550_000,
      unitPriceCtsPerT: 615_000,
      totalAmountCts: 953_250,
    });
  });

  it("refuses a zero net weight", () => {
    expect(() =>
      settleWeighing({ grossWeightG: 5_000_000, tareWeightG: 5_000_000, unitPriceCtsPerT: 100 }),
    ).toThrowError(expect.objectContaining({ code: "NET_WEIGHT_ZERO" }));
  });

  it("accepts a zero price (free disposal) but not a negative one", () => {
    expect(computeTotalAmountCts(1_000_000, 0)).toBe(0);
    expect(() => computeTotalAmountCts(1_000_000, -5)).toThrow(DomainError);
  });
});

describe("checkCompletion", () => {
  const complete = {
    status: "open" as const,
    supplierId: "s1",
    materialId: "m1",
    plateSnapshot: "VD123456",
    grossWeightG: 8_420_000,
    tareWeightG: 6_870_000,
    unitPriceCtsPerT: 615_000,
  };

  it("passes a complete open ticket", () => {
    expect(checkCompletion(complete)).toEqual({ ok: true });
  });

  it("lists every missing piece of information", () => {
    expect(
      checkCompletion({
        ...complete,
        supplierId: null,
        materialId: undefined,
        plateSnapshot: "  ",
        tareWeightG: null,
      }),
    ).toEqual({
      ok: false,
      reasons: ["SUPPLIER_MISSING", "MATERIAL_MISSING", "PLATE_MISSING", "TARE_MISSING"],
    });
  });

  it("refuses completed or cancelled tickets", () => {
    expect(checkCompletion({ ...complete, status: "completed" })).toEqual({
      ok: false,
      reasons: ["TICKET_NOT_OPEN"],
    });
  });

  it("reports impossible weights", () => {
    expect(checkCompletion({ ...complete, tareWeightG: 9_000_000 })).toEqual({
      ok: false,
      reasons: ["TARE_EXCEEDS_GROSS"],
    });
    expect(checkCompletion({ ...complete, tareWeightG: 8_420_000 })).toEqual({
      ok: false,
      reasons: ["NET_WEIGHT_ZERO"],
    });
  });
});

describe("plates", () => {
  it("normalizes and formats Swiss plates", () => {
    expect(normalizePlate("vd 123'456")).toBe("VD123456");
    expect(formatPlateDisplay("vd123456")).toBe("VD 123 456");
    expect(formatPlateDisplay("GE 12")).toBe("GE 12");
    expect(formatPlateDisplay("ZH 1234")).toBe("ZH 1 234");
    expect(formatPlateDisplay("f-ab-123-cd")).toBe("F-AB-123-CD");
  });
});
