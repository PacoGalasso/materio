/**
 * The single place where numbers, money, weights and dates become Swiss-formatted strings.
 *
 * Conventions: CHF 9'532.50 · 1'550 kg · 12.4 t · 01.09.2026 · 14:42
 * Formatting is implemented deterministically (no locale-dependent ICU output) so that
 * server and client render identical strings.
 */
import { formatScaledDecimal } from "@/domain/decimal";
import { unitPriceToDisplayDecimal, type PriceUnit } from "@/domain/pricing";
import { GRAMS_SCALE_FROM_KG } from "@/domain/units";

import { YARD_TIME_ZONE, dayKey, zonedParts } from "./time";

const GROUP_SEPARATOR = "'";

/** Groups the integer part of a plain decimal string with apostrophes: "9532.50" → "9'532.50". */
export function groupDigits(plain: string): string {
  const negative = plain.startsWith("-");
  const body = negative ? plain.slice(1) : plain;
  const [intPart = "", fracPart] = body.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  return `${negative ? "-" : ""}${grouped}${fracPart !== undefined ? `.${fracPart}` : ""}`;
}

export function formatInteger(value: number): string {
  return groupDigits(Math.trunc(value).toString());
}

/** Formats a scaled integer as a grouped decimal string. */
export function formatScaled(
  value: number,
  scale: number,
  options: { minFraction?: number; maxFraction?: number } = {},
): string {
  return groupDigits(formatScaledDecimal(value, scale, options));
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** "CHF 9'532.50" — always two decimals. */
export function formatChf(cts: number): string {
  return `CHF ${formatScaled(cts, 2)}`;
}

/** "9'532.50" — for table columns where the currency is in the header. */
export function formatAmount(cts: number): string {
  return formatScaled(cts, 2);
}

/** "CHF 6.15/kg" or "CHF 185.00/t". */
export function formatUnitPrice(ctsPerT: number, unit: PriceUnit): string {
  return `CHF ${groupDigits(unitPriceToDisplayDecimal(ctsPerT, unit))}/${unit}`;
}

/** "6.15" — the bare price in its display unit (unit shown separately). */
export function formatUnitPriceValue(ctsPerT: number, unit: PriceUnit): string {
  return groupDigits(unitPriceToDisplayDecimal(ctsPerT, unit));
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** "1'550 kg" — kilograms, decimals only when the value is not a whole kilogram. */
export function formatKg(grams: number, options: { maxFraction?: number } = {}): string {
  return `${formatKgValue(grams, options)} kg`;
}

/** "1'550" — bare kilogram value. */
export function formatKgValue(grams: number, options: { maxFraction?: number } = {}): string {
  return formatScaled(grams, GRAMS_SCALE_FROM_KG, {
    minFraction: 0,
    maxFraction: options.maxFraction ?? 1,
  });
}

/** "12.4 t" — tonnes with one decimal. */
export function formatTonnes(grams: number): string {
  return `${formatScaled(grams, 6, { minFraction: 1, maxFraction: 1 })} t`;
}

/** Kilograms below 10 t, tonnes above — for dashboard totals. */
export function formatWeight(grams: number): string {
  return Math.abs(grams) >= 10_000_000 ? formatTonnes(grams) : formatKg(grams, { maxFraction: 0 });
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function two(value: number): string {
  return String(value).padStart(2, "0");
}

/** "01.09.2026" */
export function formatDate(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${two(parts.day)}.${two(parts.month)}.${parts.year}`;
}

/** "14:42" */
export function formatTime(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${two(parts.hour)}:${two(parts.minute)}`;
}

/** "01.09.2026 · 14:42" */
export function formatDateTime(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  return `${formatDate(date, timeZone)} · ${formatTime(date, timeZone)}`;
}

const MONTHS_SHORT_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const WEEKDAYS_SHORT_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** "1 sept." — compact axis/label date. */
export function formatDayShort(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.day} ${MONTHS_SHORT_FR[parts.month - 1] ?? ""}`;
}

/** "lun." */
export function formatWeekdayShort(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  return WEEKDAYS_SHORT_FR[zonedParts(date, timeZone).weekday] ?? "";
}

/** "Aujourd'hui · 14:42", "Hier · 09:10", otherwise "28.08.2026 · 16:05". */
export function formatRelativeDateTime(
  date: Date,
  now: Date,
  timeZone: string = YARD_TIME_ZONE,
): string {
  const key = dayKey(date, timeZone);
  const today = dayKey(now, timeZone);
  if (key === today) return `Aujourd'hui · ${formatTime(date, timeZone)}`;
  const yesterday = dayKey(new Date(now.getTime() - 24 * 3_600_000), timeZone);
  if (key === yesterday) return `Hier · ${formatTime(date, timeZone)}`;
  return formatDateTime(date, timeZone);
}

/** "2026-09-01" for <input type="date"> values. */
export function toDateInputValue(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  return dayKey(date, timeZone);
}

/** "14:42" for <input type="time"> values. */
export function toTimeInputValue(date: Date, timeZone: string = YARD_TIME_ZONE): string {
  return formatTime(date, timeZone);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** "42 %" with no decimals, or one decimal below 10 %. */
export function formatPercent(ratio: number): string {
  const pct = ratio * 100;
  const rounded = pct < 10 ? Math.round(pct * 10) / 10 : Math.round(pct);
  return `${rounded.toString().replace(".", ".")} %`;
}

/** Pluralizes a French noun with its count: "3 pesées", "1 pesée". */
export function countLabel(
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}
