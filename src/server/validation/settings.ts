import { z } from "zod";

import type { FieldErrors } from "../actions/result";
import type { OrganizationInput, YardInput } from "../use-cases/settings";
import { fieldErrorsFromZod, formString, shortTextSchema } from "./form";

const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Indiquez le nom de l'entreprise." })
    .max(120, { error: "Nom trop long." }),
  legalName: z
    .string()
    .trim()
    .min(2, { error: "Indiquez la raison sociale." })
    .max(160, { error: "Raison sociale trop longue." }),
  street: shortTextSchema(120),
  postalCode: shortTextSchema(12),
  city: shortTextSchema(80),
  canton: shortTextSchema(2).transform((value) => value.toUpperCase()),
  vatNumber: shortTextSchema(40),
  phone: shortTextSchema(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      error: "Adresse e-mail invalide.",
    }),
  ticketPrefix: z
    .string()
    .trim()
    .min(1, { error: "Indiquez un préfixe." })
    .max(6, { error: "Préfixe trop long (6 caractères max.)." })
    .regex(/^[A-Za-z0-9]+$/, { error: "Lettres et chiffres uniquement." })
    .transform((value) => value.toUpperCase()),
});

export type ParsedOrganizationForm =
  { ok: true; value: OrganizationInput } | { ok: false; fieldErrors: FieldErrors };

export function parseOrganizationForm(formData: FormData): ParsedOrganizationForm {
  const parsed = organizationSchema.safeParse({
    name: formString(formData, "name"),
    legalName: formString(formData, "legalName"),
    street: formString(formData, "street"),
    postalCode: formString(formData, "postalCode"),
    city: formString(formData, "city"),
    canton: formString(formData, "canton"),
    vatNumber: formString(formData, "vatNumber"),
    phone: formString(formData, "phone"),
    email: formString(formData, "email"),
    ticketPrefix: formString(formData, "ticketPrefix"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  return { ok: true, value: parsed.data };
}

const yardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Indiquez le nom du site." })
    .max(80, { error: "Nom trop long." }),
  code: z
    .string()
    .trim()
    .min(1, { error: "Indiquez un code." })
    .max(8, { error: "Code trop long." })
    .regex(/^[A-Za-z0-9-]+$/, { error: "Lettres, chiffres et tirets uniquement." })
    .transform((value) => value.toUpperCase()),
});

export type ParsedYardForm =
  { ok: true; value: YardInput } | { ok: false; fieldErrors: FieldErrors };

export function parseYardForm(formData: FormData): ParsedYardForm {
  const parsed = yardSchema.safeParse({
    name: formString(formData, "name"),
    code: formString(formData, "code"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  return { ok: true, value: parsed.data };
}
