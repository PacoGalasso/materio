/**
 * Canonical units.
 *
 * Weights   → integer grams              (Grams)
 * Money     → integer CHF centimes        (Centimes)
 * Unit price→ integer centimes per tonne  (CentimesPerTonne)
 *
 * All arithmetic is done on integers. Values must stay below Number.MAX_SAFE_INTEGER;
 * the largest intermediate product (grams × centimes/tonne) is checked explicitly.
 */
import { DomainError } from "./errors";

export type Grams = number;
export type Centimes = number;
export type CentimesPerTonne = number;

export const GRAMS_PER_KG = 1_000;
export const GRAMS_PER_TONNE = 1_000_000;
export const CENTIMES_PER_FRANC = 100;

/** Scale factor from a decimal CHF/kg value to centimes per tonne (×100 centimes ×1000 kg). */
export const CTS_PER_TONNE_SCALE_FROM_CHF_PER_KG = 5;
/** Scale factor from a decimal CHF/t value to centimes per tonne (×100 centimes). */
export const CTS_PER_TONNE_SCALE_FROM_CHF_PER_TONNE = 2;
/** Scale factor from a decimal kg value to grams (×1000). */
export const GRAMS_SCALE_FROM_KG = 3;

export function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Business-sane upper bounds, not just safe-integer bounds: a single weighing ticket is one
 * truck, and no scrap-metal purchase price remotely approaches these figures. Without them,
 * a crafted request could submit a technically-safe-integer but absurd value (or one close
 * enough to Number.MAX_SAFE_INTEGER to risk overflow once multiplied downstream in
 * `valueOfQuantityCts`) and have it silently accepted.
 */
export const MAX_WEIGHT_G = 200_000_000; // 200 tonnes: well beyond any real truck + trailer.
export const MAX_UNIT_PRICE_CTS_PER_T = 10_000_000; // CHF 100'000/tonne (CHF 100/kg).

export function assertWeight(value: unknown, field?: string): asserts value is Grams {
  if (!isSafeInteger(value)) throw new DomainError("WEIGHT_NOT_INTEGER", { field });
  if (value < 0) throw new DomainError("WEIGHT_NEGATIVE", { field });
  if (value > MAX_WEIGHT_G) throw new DomainError("WEIGHT_TOO_LARGE", { field });
}

export function assertUnitPrice(value: unknown, field?: string): asserts value is CentimesPerTonne {
  if (!isSafeInteger(value)) throw new DomainError("PRICE_NOT_INTEGER", { field });
  if (value < 0) throw new DomainError("PRICE_NEGATIVE", { field });
  if (value > MAX_UNIT_PRICE_CTS_PER_T) throw new DomainError("PRICE_TOO_LARGE", { field });
}

/** Rounds a non-negative rational a/b half-up using integer arithmetic only. */
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new DomainError("AMOUNT_UNSAFE");
  }
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  const quotient = Math.floor(abs / denominator);
  const remainder = abs - quotient * denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return sign * rounded;
}

/**
 * Monetary value of a quantity: grams × centimes/tonne ÷ 1'000'000, rounded half-up to the centime.
 * The sign of the quantity is preserved (negative quantities value negative amounts).
 */
export function valueOfQuantityCts(quantityG: Grams, unitPriceCtsPerT: CentimesPerTonne): Centimes {
  if (!isSafeInteger(quantityG)) throw new DomainError("WEIGHT_NOT_INTEGER");
  assertUnitPrice(unitPriceCtsPerT);
  const product = quantityG * unitPriceCtsPerT;
  if (!Number.isSafeInteger(product)) throw new DomainError("AMOUNT_UNSAFE");
  return divideRoundHalfUp(product, GRAMS_PER_TONNE);
}
