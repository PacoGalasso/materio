/**
 * Shared live computation for the weighing forms (client side). Uses exactly the same
 * domain functions as the server so the preview never disagrees with the saved result.
 */
import { parseScaledDecimal } from "@/domain/decimal";
import { DomainError } from "@/domain/errors";
import { parseUnitPrice, type PriceUnit } from "@/domain/pricing";
import { GRAMS_SCALE_FROM_KG } from "@/domain/units";
import { settleWeighing } from "@/domain/weighing";

export interface LiveSummary {
  grossWeightG: number | null;
  tareWeightG: number | null;
  netWeightG: number | null;
  unitPriceCtsPerT: number | null;
  totalAmountCts: number | null;
  /** Domain problem detected on the current values (e.g. tare above gross). */
  issue: "TARE_EXCEEDS_GROSS" | "NET_WEIGHT_ZERO" | null;
}

function parseKg(input: string): number | null {
  const result = parseScaledDecimal(input, GRAMS_SCALE_FROM_KG);
  return result.ok && result.value >= 0 ? result.value : null;
}

export function computeLiveSummary(input: {
  grossKg: string;
  tareKg: string;
  price: string;
  priceUnit: PriceUnit;
}): LiveSummary {
  const grossWeightG = parseKg(input.grossKg);
  const tareWeightG = input.tareKg.trim() === "" ? null : parseKg(input.tareKg);
  const priceResult = parseUnitPrice(input.price, input.priceUnit);
  const unitPriceCtsPerT = priceResult.ok ? priceResult.value : null;

  let netWeightG: number | null = null;
  let totalAmountCts: number | null = null;
  let issue: LiveSummary["issue"] = null;

  if (grossWeightG !== null && tareWeightG !== null) {
    try {
      const figures = settleWeighing({
        grossWeightG,
        tareWeightG,
        unitPriceCtsPerT: unitPriceCtsPerT ?? 0,
      });
      netWeightG = figures.netWeightG;
      totalAmountCts = unitPriceCtsPerT === null ? null : figures.totalAmountCts;
    } catch (error) {
      if (
        error instanceof DomainError &&
        (error.code === "TARE_EXCEEDS_GROSS" || error.code === "NET_WEIGHT_ZERO")
      ) {
        issue = error.code;
      } else {
        throw error;
      }
    }
  }

  return { grossWeightG, tareWeightG, netWeightG, unitPriceCtsPerT, totalAmountCts, issue };
}
