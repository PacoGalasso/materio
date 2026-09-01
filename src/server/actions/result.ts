import { isDomainError } from "@/domain/errors";
import { DOMAIN_ERROR_MESSAGES } from "@/lib/labels";

export type FieldErrors = Record<string, string>;

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; formError?: string; fieldErrors: FieldErrors };

export const GENERIC_ERROR_MESSAGE =
  "L'opération n'a pas pu être enregistrée. Réessayez ; si le problème persiste, contactez le support.";

export function failure(fieldErrors: FieldErrors, formError?: string): ActionResult<never> {
  return { ok: false, fieldErrors, ...(formError ? { formError } : {}) };
}

/**
 * Maps a thrown error to an action result. Domain errors become field or form messages;
 * anything else is logged server-side and replaced by a generic French message.
 */
export function failureFromError(
  error: unknown,
  fieldMap: Record<string, string> = {},
): ActionResult<never> {
  if (isDomainError(error)) {
    const message = DOMAIN_ERROR_MESSAGES[error.code];
    const field = error.field ? (fieldMap[error.field] ?? error.field) : undefined;
    return field ? failure({ [field]: message }) : failure({}, message);
  }
  console.error("Unexpected error in server action:", error);
  return failure({}, GENERIC_ERROR_MESSAGE);
}
