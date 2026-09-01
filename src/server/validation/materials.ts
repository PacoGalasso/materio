import { z } from "zod";

import { MATERIAL_CATEGORIES, PRICE_UNITS } from "@/db/schema";
import type { PriceUnit } from "@/domain/pricing";

import type { FieldErrors } from "../actions/result";
import type { MaterialInput } from "../use-cases/materials";
import { fieldErrorsFromZod, formString, parseDateTime, parsePrice, shortTextSchema } from "./form";

export const materialSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, { error: "Indiquez un code (2 à 12 caractères)." })
    .max(12, { error: "Code trop long (12 caractères max.)." })
    .regex(/^[A-Za-z0-9-]+$/, { error: "Lettres, chiffres et tirets uniquement." })
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, { error: "Indiquez le nom de la matière." })
    .max(80, { error: "Nom trop long." }),
  category: z.enum(MATERIAL_CATEGORIES, { error: "Sélectionnez une catégorie." }),
  priceUnit: z.enum(PRICE_UNITS, { error: "Sélectionnez une unité de prix." }),
  isActive: z.boolean(),
});

export type ParsedMaterialForm =
  { ok: true; value: MaterialInput } | { ok: false; fieldErrors: FieldErrors };

export function parseMaterialForm(formData: FormData): ParsedMaterialForm {
  const parsed = materialSchema.safeParse({
    code: formString(formData, "code"),
    name: formString(formData, "name"),
    category: formString(formData, "category"),
    priceUnit: formString(formData, "priceUnit"),
    isActive: formData.get("isActive") === null ? true : formString(formData, "isActive") === "on",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  return { ok: true, value: parsed.data };
}

export type ParsedPriceForm =
  | { ok: true; value: { priceCtsPerT: number; effectiveFrom: Date; note: string } }
  | { ok: false; fieldErrors: FieldErrors };

export function parsePriceForm(formData: FormData, priceUnit: PriceUnit): ParsedPriceForm {
  const fieldErrors: FieldErrors = {};
  const price = parsePrice(formString(formData, "price"), priceUnit);
  if (!price.ok) fieldErrors.price = price.message;
  const effectiveFrom = parseDateTime(
    formString(formData, "effectiveDate"),
    formString(formData, "effectiveTime") || "00:00",
  );
  if (!effectiveFrom.ok) fieldErrors.effectiveDate = effectiveFrom.message;
  const note = shortTextSchema(200).safeParse(formString(formData, "note"));
  if (!note.success) fieldErrors.note = note.error.issues[0]?.message ?? "Note invalide.";
  if (!price.ok || !effectiveFrom.ok || !note.success) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { priceCtsPerT: price.value, effectiveFrom: effectiveFrom.value, note: note.data },
  };
}
