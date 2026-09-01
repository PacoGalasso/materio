/**
 * Exact decimal ↔ scaled-integer conversion without floating point.
 *
 * `parseScaledDecimal("6.15", 5)` → 615000   (CHF/kg → centimes per tonne)
 * `parseScaledDecimal("8'420.5", 3)` → 8420500 (kg → grams)
 * `formatScaledDecimal(615000, 5)` → "6.15"
 *
 * Accepted input: optional sign, digits with Swiss/French thousands separators
 * (apostrophe, right single quote, regular/narrow/no-break spaces), and a decimal
 * separator which may be "." or ",". A comma is always treated as the decimal separator.
 */

export type ParseDecimalResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" | "too_many_decimals" | "unsafe" };

const THOUSANDS_SEPARATORS = /['’   ]/g;

export function parseScaledDecimal(input: string, scale: number): ParseDecimalResult {
  const cleaned = input.trim().replace(THOUSANDS_SEPARATORS, "").replace(",", ".");
  if (cleaned.length === 0) return { ok: false, reason: "empty" };
  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return { ok: false, reason: "invalid" };
  const sign = match[1] === "-" ? -1 : 1;
  const intPart = match[2] ?? "";
  const fracPart = match[3] ?? "";
  if (intPart.length === 0 && fracPart.length === 0) return { ok: false, reason: "invalid" };
  if (fracPart.length > scale) {
    // Allow trailing zeros beyond the scale ("6.150000") but never silently truncate precision.
    const excess = fracPart.slice(scale);
    if (/[1-9]/.test(excess)) return { ok: false, reason: "too_many_decimals" };
  }
  const digits = (intPart || "0") + fracPart.slice(0, scale).padEnd(scale, "0");
  if (digits.length > 15) return { ok: false, reason: "unsafe" };
  const value = sign * Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(value)) return { ok: false, reason: "unsafe" };
  return { ok: true, value: value === 0 ? 0 : value };
}

/**
 * Formats a scaled integer as a plain decimal string ("1234.5"), without grouping.
 * `minFraction`/`maxFraction` control the number of decimals shown.
 */
export function formatScaledDecimal(
  value: number,
  scale: number,
  options: { minFraction?: number; maxFraction?: number } = {},
): string {
  if (!Number.isSafeInteger(value))
    throw new RangeError("formatScaledDecimal expects a safe integer");
  const minFraction = options.minFraction ?? scale;
  const maxFraction = Math.max(minFraction, options.maxFraction ?? scale);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const factor = 10 ** scale;
  let intPart = Math.floor(abs / factor);
  let frac = abs - intPart * factor;
  let fracStr = frac.toString().padStart(scale, "0");
  if (maxFraction < scale) {
    // Round half-up to maxFraction decimals.
    const drop = scale - maxFraction;
    const dropFactor = 10 ** drop;
    const keep = Math.floor(frac / dropFactor);
    const remainder = frac - keep * dropFactor;
    let kept = remainder * 2 >= dropFactor ? keep + 1 : keep;
    if (kept >= 10 ** maxFraction) {
      kept = 0;
      intPart += 1;
    }
    frac = kept;
    fracStr = maxFraction > 0 ? kept.toString().padStart(maxFraction, "0") : "";
  }
  // Trim trailing zeros down to minFraction.
  while (fracStr.length > minFraction && fracStr.endsWith("0")) {
    fracStr = fracStr.slice(0, -1);
  }
  return fracStr.length > 0 ? `${sign}${intPart}.${fracStr}` : `${sign}${intPart}`;
}
