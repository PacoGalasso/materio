/**
 * Inventory rules: movements are the single source of truth; stock is their signed sum.
 */
import { DomainError } from "./errors";
import {
  assertUnitPrice,
  assertWeight,
  type Centimes,
  type CentimesPerTonne,
  type Grams,
  valueOfQuantityCts,
} from "./units";

export type MovementType = "receipt" | "dispatch" | "adjustment";

export interface MovementFigures {
  type: MovementType;
  quantityG: Grams;
  unitValueCtsPerT: CentimesPerTonne;
  amountCts: Centimes;
}

/** The inventory receipt generated when an inbound weighing is completed. */
export function receiptFromCompletedWeighing(figures: {
  netWeightG: Grams;
  unitPriceCtsPerT: CentimesPerTonne;
  totalAmountCts: Centimes;
}): MovementFigures {
  assertWeight(figures.netWeightG);
  if (figures.netWeightG === 0) throw new DomainError("QUANTITY_ZERO");
  assertUnitPrice(figures.unitPriceCtsPerT);
  return {
    type: "receipt",
    quantityG: figures.netWeightG,
    unitValueCtsPerT: figures.unitPriceCtsPerT,
    amountCts: figures.totalAmountCts,
  };
}

/** A dispatch (material leaving the yard): negative quantity, negative amount. */
export function dispatchMovement(input: {
  quantityG: Grams;
  unitValueCtsPerT: CentimesPerTonne;
  currentStockG: Grams;
}): MovementFigures {
  assertWeight(input.quantityG);
  if (input.quantityG === 0) throw new DomainError("QUANTITY_ZERO", { field: "quantity" });
  assertUnitPrice(input.unitValueCtsPerT, "unitValue");
  if (input.quantityG > input.currentStockG) {
    throw new DomainError("STOCK_INSUFFICIENT", { field: "quantity" });
  }
  return {
    type: "dispatch",
    quantityG: -input.quantityG,
    unitValueCtsPerT: input.unitValueCtsPerT,
    amountCts: -valueOfQuantityCts(input.quantityG, input.unitValueCtsPerT),
  };
}

/** A manual correction (opening balance, count adjustment). Sign is given by the caller. */
export function adjustmentMovement(input: {
  quantityG: Grams;
  unitValueCtsPerT: CentimesPerTonne;
}): MovementFigures {
  if (!Number.isSafeInteger(input.quantityG)) throw new DomainError("WEIGHT_NOT_INTEGER");
  if (input.quantityG === 0) throw new DomainError("QUANTITY_ZERO", { field: "quantity" });
  assertUnitPrice(input.unitValueCtsPerT, "unitValue");
  return {
    type: "adjustment",
    quantityG: input.quantityG,
    unitValueCtsPerT: input.unitValueCtsPerT,
    amountCts: valueOfQuantityCts(input.quantityG, input.unitValueCtsPerT),
  };
}

export interface StockLine {
  materialId: string;
  quantityG: Grams;
  lastMovementAt: Date | null;
}

/** Aggregates signed movements into stock per material (pure; the DB does this with SUM in queries). */
export function aggregateStock(
  movements: ReadonlyArray<{ materialId: string; quantityG: Grams; occurredAt: Date }>,
): Map<string, StockLine> {
  const lines = new Map<string, StockLine>();
  for (const movement of movements) {
    const line = lines.get(movement.materialId) ?? {
      materialId: movement.materialId,
      quantityG: 0,
      lastMovementAt: null,
    };
    line.quantityG += movement.quantityG;
    if (!line.lastMovementAt || movement.occurredAt > line.lastMovementAt) {
      line.lastMovementAt = movement.occurredAt;
    }
    lines.set(movement.materialId, line);
  }
  return lines;
}

/** Estimated value of a stock quantity at a reference price. */
export function stockValueCts(quantityG: Grams, referencePriceCtsPerT: CentimesPerTonne): Centimes {
  return valueOfQuantityCts(quantityG, referencePriceCtsPerT);
}

/**
 * Weighted average purchase price of receipts, in centimes per tonne (rounded half-up).
 * Returns null when there is no received quantity.
 */
export function weightedAveragePriceCtsPerT(
  receipts: ReadonlyArray<{ quantityG: Grams; amountCts: Centimes }>,
): CentimesPerTonne | null {
  let quantity = 0;
  let amount = 0;
  for (const receipt of receipts) {
    if (receipt.quantityG <= 0) continue;
    quantity += receipt.quantityG;
    amount += receipt.amountCts;
  }
  if (quantity === 0) return null;
  // price = amount / quantity × 1'000'000 (grams per tonne)
  const numerator = amount * 1_000_000;
  if (!Number.isSafeInteger(numerator)) throw new DomainError("AMOUNT_UNSAFE");
  return Math.round(numerator / quantity);
}
