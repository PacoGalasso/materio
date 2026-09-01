import type { PriceUnit } from "@/domain/pricing";

import type { FieldErrors } from "../actions/result";
import { formString, parseDateTime, parsePrice, parseWeightKg, shortTextSchema } from "./form";

export type ParsedMovementForm =
  | {
      ok: true;
      value: { quantityG: number; unitValueCtsPerT: number; occurredAt: Date; note: string };
    }
  | { ok: false; fieldErrors: FieldErrors };

/** Dispatch / adjustment forms: quantity in kg, value in the material's display unit. */
export function parseMovementForm(formData: FormData, priceUnit: PriceUnit): ParsedMovementForm {
  const fieldErrors: FieldErrors = {};
  const quantity = parseWeightKg(formString(formData, "quantity"), { required: true });
  if (!quantity.ok) fieldErrors.quantity = quantity.message;
  else if (quantity.value === 0) fieldErrors.quantity = "La quantité doit être supérieure à zéro.";
  const value = parsePrice(formString(formData, "unitValue"), priceUnit);
  if (!value.ok) fieldErrors.unitValue = value.message;
  const occurredAt = parseDateTime(formString(formData, "date"), formString(formData, "time"));
  if (!occurredAt.ok) fieldErrors.time = occurredAt.message;
  const note = shortTextSchema(200).safeParse(formString(formData, "note"));
  if (!note.success) fieldErrors.note = note.error.issues[0]?.message ?? "Note invalide.";

  if (
    !quantity.ok ||
    quantity.value === null ||
    quantity.value === 0 ||
    !value.ok ||
    !occurredAt.ok ||
    !note.success
  ) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      quantityG: quantity.value,
      unitValueCtsPerT: value.value,
      occurredAt: occurredAt.value,
      note: note.data,
    },
  };
}
