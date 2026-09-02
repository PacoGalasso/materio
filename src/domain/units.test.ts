import { describe, expect, it } from "vitest";

import { DomainError } from "./errors";
import {
  assertUnitPrice,
  assertWeight,
  divideRoundHalfUp,
  MAX_UNIT_PRICE_CTS_PER_T,
  MAX_WEIGHT_G,
  valueOfQuantityCts,
} from "./units";

describe("assertWeight", () => {
  it("accepts zero and values at the upper bound", () => {
    expect(() => assertWeight(0)).not.toThrow();
    expect(() => assertWeight(MAX_WEIGHT_G)).not.toThrow();
  });

  it("rejects non-integers, negatives and business-implausible values", () => {
    expect(() => assertWeight(1.5)).toThrow(DomainError);
    expect(() => assertWeight(-1)).toThrow(DomainError);
    expect(() => assertWeight(MAX_WEIGHT_G + 1)).toThrow(DomainError);
    expect(() => assertWeight(Number.MAX_SAFE_INTEGER)).toThrow(DomainError);
    expect(() => assertWeight("8420000")).toThrow(DomainError);
    expect(() => assertWeight(Number.POSITIVE_INFINITY)).toThrow(DomainError);
  });
});

describe("assertUnitPrice", () => {
  it("accepts zero and values at the upper bound", () => {
    expect(() => assertUnitPrice(0)).not.toThrow();
    expect(() => assertUnitPrice(MAX_UNIT_PRICE_CTS_PER_T)).not.toThrow();
  });

  it("rejects non-integers, negatives and business-implausible values", () => {
    expect(() => assertUnitPrice(1.5)).toThrow(DomainError);
    expect(() => assertUnitPrice(-1)).toThrow(DomainError);
    expect(() => assertUnitPrice(MAX_UNIT_PRICE_CTS_PER_T + 1)).toThrow(DomainError);
  });
});

describe("divideRoundHalfUp", () => {
  it("rounds half up on exact halves", () => {
    expect(divideRoundHalfUp(5, 10)).toBe(1);
    expect(divideRoundHalfUp(15, 10)).toBe(2);
    expect(divideRoundHalfUp(14, 10)).toBe(1);
    expect(divideRoundHalfUp(-15, 10)).toBe(-2);
  });

  it("rejects unsafe operands", () => {
    expect(() => divideRoundHalfUp(1.5, 10)).toThrow(DomainError);
    expect(() => divideRoundHalfUp(10, 0)).toThrow(DomainError);
  });
});

describe("valueOfQuantityCts (monetary precision)", () => {
  it("computes CHF 9'532.50 for 1'550 kg at CHF 6.15/kg", () => {
    // 1'550 kg = 1'550'000 g ; CHF 6.15/kg = 615'000 cts/t
    expect(valueOfQuantityCts(1_550_000, 615_000)).toBe(953_250);
  });

  it("never suffers floating point drift", () => {
    // 0.1 + 0.2 style trap: 3 kg × CHF 0.10/kg = CHF 0.30 exactly
    expect(valueOfQuantityCts(3_000, 10_000)).toBe(30);
    // 1 g at CHF 0.001/kg (100 cts/t) = 0.0001 cts → rounds to 0
    expect(valueOfQuantityCts(1, 100)).toBe(0);
    // 12'345.678 kg at CHF 0.185/kg = 2283.95043 CHF → 228'395 cts
    expect(valueOfQuantityCts(12_345_678, 18_500)).toBe(228_395);
  });

  it("rounds half-up to the centime", () => {
    // 5 g at CHF 1/kg = 0.5 cts → 1 ct
    expect(valueOfQuantityCts(5, 100_000)).toBe(1);
    // 4 g at CHF 1/kg = 0.4 cts → 0
    expect(valueOfQuantityCts(4, 100_000)).toBe(0);
  });

  it("supports large industrial quantities without overflow", () => {
    // 5'000 t of steel at CHF 250/t
    expect(valueOfQuantityCts(5_000_000_000, 25_000)).toBe(125_000_000);
  });

  it("rejects invalid inputs", () => {
    expect(() => valueOfQuantityCts(1.5, 100)).toThrow(DomainError);
    expect(() => valueOfQuantityCts(1000, -1)).toThrow(DomainError);
    expect(() => valueOfQuantityCts(1000, 1.5)).toThrow(DomainError);
    expect(() => valueOfQuantityCts(Number.MAX_SAFE_INTEGER, 1_000_000)).toThrow(DomainError);
  });
});
