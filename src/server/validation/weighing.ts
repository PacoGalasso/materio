import { z } from "zod";

import type { PriceUnit } from "@/domain/pricing";

import type { FieldErrors } from "../actions/result";
import type { CreateWeighingInput } from "../use-cases/weighing";
import {
  fieldErrorsFromZod,
  formString,
  idSchema,
  parseDateTime,
  parsePrice,
  parseWeightKg,
  shortTextSchema,
} from "./form";

const weighingFormSchema = z.object({
  supplierId: idSchema.min(1, { error: "Sélectionnez un fournisseur." }),
  plate: z
    .string()
    .trim()
    .min(2, { error: "Indiquez l'immatriculation du véhicule." })
    .max(20, { error: "Immatriculation trop longue." }),
  materialId: idSchema.min(1, { error: "Sélectionnez une matière." }),
  externalReference: shortTextSchema(60),
  notes: shortTextSchema(1000),
});

export type ParsedWeighingForm =
  { ok: true; value: CreateWeighingInput } | { ok: false; fieldErrors: FieldErrors };

/**
 * Parses the new-weighing form. `priceUnitOf` resolves the display unit of the selected
 * material so the typed price can be converted to centimes per tonne.
 */
export function parseWeighingForm(formData: FormData, priceUnit: PriceUnit): ParsedWeighingForm {
  const parsed = weighingFormSchema.safeParse({
    supplierId: formString(formData, "supplierId"),
    plate: formString(formData, "plate"),
    materialId: formString(formData, "materialId"),
    externalReference: formString(formData, "externalReference"),
    notes: formString(formData, "notes"),
  });
  const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsFromZod(parsed.error);

  const gross = parseWeightKg(formString(formData, "grossWeight"), { required: true });
  if (!gross.ok) fieldErrors.grossWeight = gross.message;
  const tare = parseWeightKg(formString(formData, "tareWeight"));
  if (!tare.ok) fieldErrors.tareWeight = tare.message;
  const price = parsePrice(formString(formData, "unitPrice"), priceUnit);
  if (!price.ok) fieldErrors.unitPrice = price.message;
  const grossAt = parseDateTime(
    formString(formData, "grossDate"),
    formString(formData, "grossTime"),
  );
  if (!grossAt.ok) fieldErrors.grossTime = grossAt.message;

  if (
    gross.ok &&
    tare.ok &&
    tare.value !== null &&
    gross.value !== null &&
    tare.value > gross.value
  ) {
    fieldErrors.tareWeight = "La tare ne peut pas dépasser le poids brut.";
  }
  if (
    gross.ok &&
    tare.ok &&
    tare.value !== null &&
    gross.value !== null &&
    tare.value === gross.value
  ) {
    fieldErrors.tareWeight = "Le poids net doit être supérieur à zéro.";
  }

  if (
    !parsed.success ||
    !gross.ok ||
    !tare.ok ||
    !price.ok ||
    !grossAt.ok ||
    gross.value === null ||
    Object.keys(fieldErrors).length > 0
  ) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      supplierId: parsed.data.supplierId,
      plate: parsed.data.plate,
      materialId: parsed.data.materialId,
      unitPriceCtsPerT: price.value,
      grossWeightG: gross.value,
      grossWeighedAt: grossAt.value,
      tareWeightG: tare.value,
      tareWeighedAt:
        tare.value === null ? null : new Date(Math.max(grossAt.value.getTime(), Date.now())),
      externalReference: parsed.data.externalReference,
      notes: parsed.data.notes,
    },
  };
}

export type ParsedCompletionForm =
  | {
      ok: true;
      value: { tareWeightG: number; tareWeighedAt: Date; unitPriceCtsPerT: number; notes: string };
    }
  | { ok: false; fieldErrors: FieldErrors };

export function parseCompletionForm(
  formData: FormData,
  priceUnit: PriceUnit,
): ParsedCompletionForm {
  const fieldErrors: FieldErrors = {};
  const tare = parseWeightKg(formString(formData, "tareWeight"), { required: true });
  if (!tare.ok) fieldErrors.tareWeight = tare.message;
  const price = parsePrice(formString(formData, "unitPrice"), priceUnit);
  if (!price.ok) fieldErrors.unitPrice = price.message;
  const tareAt = parseDateTime(formString(formData, "tareDate"), formString(formData, "tareTime"));
  if (!tareAt.ok) fieldErrors.tareTime = tareAt.message;
  const notes = shortTextSchema(1000).safeParse(formString(formData, "notes"));
  if (!notes.success) fieldErrors.notes = notes.error.issues[0]?.message ?? "Notes invalides.";

  if (!tare.ok || tare.value === null || !price.ok || !tareAt.ok || !notes.success) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      tareWeightG: tare.value,
      tareWeighedAt: tareAt.value,
      unitPriceCtsPerT: price.value,
      notes: notes.data,
    },
  };
}
