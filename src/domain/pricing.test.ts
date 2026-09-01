import { describe, expect, it } from "vitest";

import { parseUnitPrice, unitPriceToDisplayDecimal } from "./pricing";

describe("unit price conversions", () => {
  it("stores CHF/kg and CHF/t inputs in the same canonical unit", () => {
    expect(parseUnitPrice("6.15", "kg")).toEqual({ ok: true, value: 615_000 });
    expect(parseUnitPrice("6150", "t")).toEqual({ ok: true, value: 615_000 });
    expect(parseUnitPrice("185", "t")).toEqual({ ok: true, value: 18_500 });
    expect(parseUnitPrice("0.185", "kg")).toEqual({ ok: true, value: 18_500 });
  });

  it("refuses negative prices and excess precision", () => {
    expect(parseUnitPrice("-1", "kg")).toEqual({ ok: false, reason: "invalid" });
    expect(parseUnitPrice("0.1234", "kg")).toEqual({ ok: false, reason: "too_many_decimals" });
    expect(parseUnitPrice("185.005", "t")).toEqual({ ok: false, reason: "too_many_decimals" });
  });

  it("renders the canonical price in the display unit", () => {
    expect(unitPriceToDisplayDecimal(615_000, "kg")).toBe("6.15");
    expect(unitPriceToDisplayDecimal(18_500, "kg")).toBe("0.185");
    expect(unitPriceToDisplayDecimal(18_500, "t")).toBe("185.00");
    expect(unitPriceToDisplayDecimal(615_000, "t")).toBe("6150.00");
  });
});
