import { z } from "zod";

import type { FieldErrors } from "../actions/result";
import type { SupplierInput } from "../use-cases/suppliers";
import { fieldErrorsFromZod, formString, shortTextSchema } from "./form";

const optionalEmail = z
  .string()
  .trim()
  .max(120)
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    error: "Adresse e-mail invalide.",
  });

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Indiquez le nom du fournisseur." })
    .max(120, { error: "Nom trop long." }),
  contactName: shortTextSchema(120),
  email: optionalEmail,
  phone: shortTextSchema(40),
  street: shortTextSchema(120),
  postalCode: shortTextSchema(12),
  city: shortTextSchema(80),
  canton: shortTextSchema(2).transform((value) => value.toUpperCase()),
  vatNumber: shortTextSchema(40),
  notes: shortTextSchema(2000),
  isActive: z.boolean(),
});

export type ParsedSupplierForm =
  { ok: true; value: SupplierInput } | { ok: false; fieldErrors: FieldErrors };

export function parseSupplierForm(formData: FormData): ParsedSupplierForm {
  const parsed = supplierSchema.safeParse({
    name: formString(formData, "name"),
    contactName: formString(formData, "contactName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    street: formString(formData, "street"),
    postalCode: formString(formData, "postalCode"),
    city: formString(formData, "city"),
    canton: formString(formData, "canton"),
    vatNumber: formString(formData, "vatNumber"),
    notes: formString(formData, "notes"),
    isActive: formData.get("isActive") === null ? true : formString(formData, "isActive") === "on",
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  return { ok: true, value: parsed.data };
}

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(2, { error: "Indiquez l'immatriculation." })
    .max(20, { error: "Immatriculation trop longue." }),
  description: shortTextSchema(80),
});
