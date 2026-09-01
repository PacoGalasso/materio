import { describe, expect, it } from "vitest";

import { formatScaledDecimal, parseScaledDecimal } from "./decimal";

describe("parseScaledDecimal", () => {
  it("parses kilograms to grams exactly", () => {
    expect(parseScaledDecimal("8420", 3)).toEqual({ ok: true, value: 8_420_000 });
    expect(parseScaledDecimal("8'420.5", 3)).toEqual({ ok: true, value: 8_420_500 });
    expect(parseScaledDecimal("8 420,25", 3)).toEqual({ ok: true, value: 8_420_250 });
    expect(parseScaledDecimal("0.001", 3)).toEqual({ ok: true, value: 1 });
    expect(parseScaledDecimal(".5", 3)).toEqual({ ok: true, value: 500 });
  });

  it("parses CHF/kg prices to centimes per tonne exactly", () => {
    expect(parseScaledDecimal("6.15", 5)).toEqual({ ok: true, value: 615_000 });
    expect(parseScaledDecimal("0.185", 5)).toEqual({ ok: true, value: 18_500 });
    expect(parseScaledDecimal("6,15", 5)).toEqual({ ok: true, value: 615_000 });
  });

  it("rejects precision loss and garbage", () => {
    expect(parseScaledDecimal("1.2345", 3)).toEqual({ ok: false, reason: "too_many_decimals" });
    expect(parseScaledDecimal("1.2340", 3)).toEqual({ ok: true, value: 1234 });
    expect(parseScaledDecimal("abc", 3)).toEqual({ ok: false, reason: "invalid" });
    expect(parseScaledDecimal("1.2.3", 3)).toEqual({ ok: false, reason: "invalid" });
    expect(parseScaledDecimal("", 3)).toEqual({ ok: false, reason: "empty" });
    expect(parseScaledDecimal("   ", 3)).toEqual({ ok: false, reason: "empty" });
    expect(parseScaledDecimal("9999999999999999", 3)).toEqual({ ok: false, reason: "unsafe" });
  });

  it("keeps the sign", () => {
    expect(parseScaledDecimal("-12.5", 3)).toEqual({ ok: true, value: -12_500 });
    expect(parseScaledDecimal("-0", 3)).toEqual({ ok: true, value: 0 });
  });
});

describe("formatScaledDecimal", () => {
  it("formats scaled integers back to decimals", () => {
    expect(formatScaledDecimal(615_000, 5, { minFraction: 2, maxFraction: 3 })).toBe("6.15");
    expect(formatScaledDecimal(18_500, 5, { minFraction: 2, maxFraction: 3 })).toBe("0.185");
    expect(formatScaledDecimal(8_420_500, 3, { minFraction: 0, maxFraction: 3 })).toBe("8420.5");
    expect(formatScaledDecimal(953_250, 2)).toBe("9532.50");
    expect(formatScaledDecimal(-953_250, 2)).toBe("-9532.50");
  });

  it("rounds half-up when reducing decimals", () => {
    expect(formatScaledDecimal(1_999_500, 3, { minFraction: 0, maxFraction: 0 })).toBe("2000");
    expect(formatScaledDecimal(1_234_567, 3, { minFraction: 1, maxFraction: 1 })).toBe("1234.6");
    expect(formatScaledDecimal(999, 3, { minFraction: 2, maxFraction: 2 })).toBe("1.00");
  });
});
