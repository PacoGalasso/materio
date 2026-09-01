/**
 * Weighing ticket rules (inbound purchase weighing).
 *
 * gross (loaded vehicle at arrival) − tare (empty vehicle at departure) = net (material received)
 * total = net × unit price (see units.ts for rounding).
 */
import { DomainError, type DomainErrorCode } from "./errors";
import {
  assertUnitPrice,
  assertWeight,
  type Centimes,
  type CentimesPerTonne,
  type Grams,
  valueOfQuantityCts,
} from "./units";

export function computeNetWeightG(grossWeightG: Grams, tareWeightG: Grams): Grams {
  assertWeight(grossWeightG, "grossWeight");
  assertWeight(tareWeightG, "tareWeight");
  if (tareWeightG > grossWeightG)
    throw new DomainError("TARE_EXCEEDS_GROSS", { field: "tareWeight" });
  return grossWeightG - tareWeightG;
}

export function computeTotalAmountCts(
  netWeightG: Grams,
  unitPriceCtsPerT: CentimesPerTonne,
): Centimes {
  assertWeight(netWeightG, "netWeight");
  assertUnitPrice(unitPriceCtsPerT, "unitPrice");
  return valueOfQuantityCts(netWeightG, unitPriceCtsPerT);
}

export interface WeighingFigures {
  grossWeightG: Grams;
  tareWeightG: Grams;
  netWeightG: Grams;
  unitPriceCtsPerT: CentimesPerTonne;
  totalAmountCts: Centimes;
}

/**
 * Computes net and total for a complete weighing. Throws DomainError on impossible values
 * (negative weights, tare above gross, zero net).
 */
export function settleWeighing(input: {
  grossWeightG: Grams;
  tareWeightG: Grams;
  unitPriceCtsPerT: CentimesPerTonne;
}): WeighingFigures {
  const netWeightG = computeNetWeightG(input.grossWeightG, input.tareWeightG);
  if (netWeightG === 0) throw new DomainError("NET_WEIGHT_ZERO", { field: "tareWeight" });
  const totalAmountCts = computeTotalAmountCts(netWeightG, input.unitPriceCtsPerT);
  return {
    grossWeightG: input.grossWeightG,
    tareWeightG: input.tareWeightG,
    netWeightG,
    unitPriceCtsPerT: input.unitPriceCtsPerT,
    totalAmountCts,
  };
}

/** Minimal shape needed to decide whether a ticket can be completed. */
export interface CompletionCandidate {
  status: "open" | "completed" | "cancelled";
  supplierId: string | null | undefined;
  materialId: string | null | undefined;
  plateSnapshot: string | null | undefined;
  grossWeightG: Grams | null | undefined;
  tareWeightG: Grams | null | undefined;
  unitPriceCtsPerT: CentimesPerTonne | null | undefined;
}

export type CompletionCheck = { ok: true } | { ok: false; reasons: DomainErrorCode[] };

/** Lists every reason a ticket cannot be completed, so the UI can show them all at once. */
export function checkCompletion(ticket: CompletionCandidate): CompletionCheck {
  const reasons: DomainErrorCode[] = [];
  if (ticket.status !== "open") reasons.push("TICKET_NOT_OPEN");
  if (!ticket.supplierId) reasons.push("SUPPLIER_MISSING");
  if (!ticket.materialId) reasons.push("MATERIAL_MISSING");
  if (!ticket.plateSnapshot || ticket.plateSnapshot.trim().length === 0)
    reasons.push("PLATE_MISSING");
  if (ticket.tareWeightG === null || ticket.tareWeightG === undefined) {
    reasons.push("TARE_MISSING");
  } else if (ticket.grossWeightG !== null && ticket.grossWeightG !== undefined) {
    try {
      const net = computeNetWeightG(ticket.grossWeightG, ticket.tareWeightG);
      if (net === 0) reasons.push("NET_WEIGHT_ZERO");
    } catch (error) {
      if (error instanceof DomainError) reasons.push(error.code);
      else throw error;
    }
  }
  if (ticket.unitPriceCtsPerT === null || ticket.unitPriceCtsPerT === undefined) {
    reasons.push("PRICE_NOT_INTEGER");
  } else if (ticket.unitPriceCtsPerT < 0) {
    reasons.push("PRICE_NEGATIVE");
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** Normalizes a licence plate for storage and matching: uppercase, alphanumerics only. */
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Formats a Swiss plate for display: canton letters, space, digits grouped ("VD 123 456"). */
export function formatPlateDisplay(plate: string): string {
  const normalized = normalizePlate(plate);
  const match = /^([A-Z]{2})(\d{1,6})$/.exec(normalized);
  if (!match) return plate.trim().toUpperCase();
  const [, canton, digits] = match;
  if (!canton || !digits) return normalized;
  if (digits.length <= 3) return `${canton} ${digits}`;
  return `${canton} ${digits.slice(0, digits.length - 3)} ${digits.slice(-3)}`;
}
