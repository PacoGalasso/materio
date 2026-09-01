/**
 * Price conversions between the canonical storage unit (centimes per tonne) and the
 * operator-facing display unit (CHF/kg or CHF/t). The display unit never changes storage.
 */
import { formatScaledDecimal, parseScaledDecimal, type ParseDecimalResult } from "./decimal";
import {
  CTS_PER_TONNE_SCALE_FROM_CHF_PER_KG,
  CTS_PER_TONNE_SCALE_FROM_CHF_PER_TONNE,
  type CentimesPerTonne,
} from "./units";

export type PriceUnit = "kg" | "t";

/** Decimal scale between the display unit and centimes per tonne. */
export function priceScale(unit: PriceUnit): number {
  return unit === "kg"
    ? CTS_PER_TONNE_SCALE_FROM_CHF_PER_KG
    : CTS_PER_TONNE_SCALE_FROM_CHF_PER_TONNE;
}

/** Maximum decimals an operator may type: CHF 0.185/kg (3) or CHF 185.50/t (2). */
export function priceInputDecimals(unit: PriceUnit): number {
  return unit === "kg" ? 3 : 2;
}

/** Parses an operator-entered price ("6.15" CHF/kg, "185" CHF/t) into centimes per tonne. */
export function parseUnitPrice(input: string, unit: PriceUnit): ParseDecimalResult {
  const decimals = priceInputDecimals(unit);
  const result = parseScaledDecimal(input, decimals);
  if (!result.ok) return result;
  if (result.value < 0) return { ok: false, reason: "invalid" };
  const value = result.value * 10 ** (priceScale(unit) - decimals);
  if (!Number.isSafeInteger(value)) return { ok: false, reason: "unsafe" };
  return { ok: true, value };
}

/**
 * Plain decimal string of a canonical price in the display unit, e.g. 615000 → "6.15" (kg)
 * or 18500 → "185.00" (t). Used to pre-fill inputs; UI formatting adds separators.
 */
export function unitPriceToDisplayDecimal(price: CentimesPerTonne, unit: PriceUnit): string {
  return formatScaledDecimal(price, priceScale(unit), {
    minFraction: 2,
    maxFraction: priceInputDecimals(unit),
  });
}
