import { z } from "zod";

import { parseScaledDecimal } from "@/domain/decimal";
import { parseUnitPrice, type PriceUnit } from "@/domain/pricing";
import { GRAMS_SCALE_FROM_KG } from "@/domain/units";
import { parseErrorMessage } from "@/lib/labels";
import { zonedDate } from "@/lib/time";

import type { FieldErrors } from "../actions/result";

/** Reads a FormData field as a trimmed string ("" when absent). */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Converts Zod issues into a flat { field: message } map (first message per field). */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** Kilograms typed by an operator → integer grams. */
export function parseWeightKg(
  input: string,
  options: { required?: boolean } = {},
): Parsed<number | null> {
  if (input.trim() === "") {
    return options.required
      ? { ok: false, message: parseErrorMessage("empty", "weight") }
      : { ok: true, value: null };
  }
  const result = parseScaledDecimal(input, GRAMS_SCALE_FROM_KG);
  if (!result.ok) return { ok: false, message: parseErrorMessage(result.reason, "weight") };
  if (result.value < 0) return { ok: false, message: "Le poids ne peut pas être négatif." };
  return { ok: true, value: result.value };
}

/** Price typed in the material's display unit → centimes per tonne. */
export function parsePrice(input: string, unit: PriceUnit): Parsed<number> {
  const result = parseUnitPrice(input, unit);
  if (!result.ok) return { ok: false, message: parseErrorMessage(result.reason, "price") };
  return { ok: true, value: result.value };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** "2026-09-01" + "14:42" (Zurich wall clock) → instant. */
export function parseDateTime(date: string, time: string): Parsed<Date> {
  const d = DATE_RE.exec(date.trim());
  const t = TIME_RE.exec(time.trim());
  if (!d || !t) return { ok: false, message: "Date ou heure invalide." };
  const year = Number(d[1]);
  const month = Number(d[2]);
  const day = Number(d[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { ok: false, message: "Date ou heure invalide." };
  }
  const instant = zonedDate({ year, month, day, hour, minute });
  if (Number.isNaN(instant.getTime())) return { ok: false, message: "Date ou heure invalide." };
  return { ok: true, value: instant };
}

export const idSchema = z.string().trim().min(1).max(64);
export const shortTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Au maximum ${max} caractères.` });
