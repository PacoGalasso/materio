/** Business-rule violations. Codes are mapped to French messages in the UI layer. */
export const DOMAIN_ERROR_CODES = [
  "WEIGHT_NOT_INTEGER",
  "WEIGHT_NEGATIVE",
  "TARE_EXCEEDS_GROSS",
  "NET_WEIGHT_ZERO",
  "PRICE_NOT_INTEGER",
  "PRICE_NEGATIVE",
  "AMOUNT_UNSAFE",
  "TARE_MISSING",
  "SUPPLIER_MISSING",
  "MATERIAL_MISSING",
  "PLATE_MISSING",
  "INVALID_STATUS_TRANSITION",
  "TICKET_NOT_OPEN",
  "TICKET_NOT_FOUND",
  "SUPPLIER_NOT_FOUND",
  "MATERIAL_NOT_FOUND",
  "MATERIAL_INACTIVE",
  "SUPPLIER_INACTIVE",
  "QUANTITY_ZERO",
  "STOCK_INSUFFICIENT",
  "DUPLICATE_MATERIAL_CODE",
  "DUPLICATE_PLATE",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  /** Optional form field the error relates to (for inline display). */
  readonly field: string | undefined;

  constructor(code: DomainErrorCode, options?: { field?: string; message?: string }) {
    super(options?.message ?? code);
    this.name = "DomainError";
    this.code = code;
    this.field = options?.field;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
