import { describe, expect, it } from "vitest";

import {
  formatChf,
  formatDate,
  formatDateTime,
  formatKg,
  formatRelativeDateTime,
  formatTime,
  formatTonnes,
  formatUnitPrice,
  formatWeight,
  groupDigits,
} from "./format";
import { addDays, dayKey, startOfDay, zonedDate } from "./time";

describe("Swiss number formatting", () => {
  it("groups thousands with apostrophes", () => {
    expect(groupDigits("9532.50")).toBe("9'532.50");
    expect(groupDigits("1234567")).toBe("1'234'567");
    expect(groupDigits("-1234.5")).toBe("-1'234.5");
    expect(groupDigits("999")).toBe("999");
  });

  it("formats money", () => {
    expect(formatChf(953_250)).toBe("CHF 9'532.50");
    expect(formatChf(4_290_050)).toBe("CHF 42'900.50");
    expect(formatChf(125_000)).toBe("CHF 1'250.00");
    expect(formatChf(0)).toBe("CHF 0.00");
  });

  it("formats weights", () => {
    expect(formatKg(1_550_000)).toBe("1'550 kg");
    expect(formatKg(840_000)).toBe("840 kg");
    expect(formatKg(840_500)).toBe("840.5 kg");
    expect(formatTonnes(12_400_000)).toBe("12.4 t");
    expect(formatWeight(12_400_000)).toBe("12.4 t");
    expect(formatWeight(9_999_000)).toBe("9'999 kg");
  });

  it("formats unit prices in the display unit", () => {
    expect(formatUnitPrice(615_000, "kg")).toBe("CHF 6.15/kg");
    expect(formatUnitPrice(18_500, "t")).toBe("CHF 185.00/t");
    expect(formatUnitPrice(18_500, "kg")).toBe("CHF 0.185/kg");
  });
});

describe("Swiss date formatting (Europe/Zurich)", () => {
  const instant = new Date("2026-09-01T12:42:00Z"); // 14:42 CEST

  it("formats dates and times in the yard time zone", () => {
    expect(formatDate(instant)).toBe("01.09.2026");
    expect(formatTime(instant)).toBe("14:42");
    expect(formatDateTime(instant)).toBe("01.09.2026 · 14:42");
  });

  it("formats relative day labels", () => {
    const now = new Date("2026-09-01T16:00:00Z");
    expect(formatRelativeDateTime(instant, now)).toBe("Aujourd'hui · 14:42");
    expect(formatRelativeDateTime(new Date("2026-08-31T07:10:00Z"), now)).toBe("Hier · 09:10");
    expect(formatRelativeDateTime(new Date("2026-08-28T14:05:00Z"), now)).toBe(
      "28.08.2026 · 16:05",
    );
  });

  it("handles day boundaries across UTC midnight", () => {
    const lateEvening = new Date("2026-09-01T22:30:00Z"); // 00:30 on 02.09 in Zurich
    expect(formatDate(lateEvening)).toBe("02.09.2026");
    expect(dayKey(lateEvening)).toBe("2026-09-02");
    expect(startOfDay(lateEvening).toISOString()).toBe("2026-09-01T22:00:00.000Z");
  });

  it("builds zoned dates and adds days across DST", () => {
    expect(zonedDate({ year: 2026, month: 3, day: 29, hour: 12 }).toISOString()).toBe(
      "2026-03-29T10:00:00.000Z",
    );
    const beforeDst = zonedDate({ year: 2026, month: 3, day: 28, hour: 9 });
    expect(formatTime(addDays(beforeDst, 1))).toBe("09:00");
  });
});
