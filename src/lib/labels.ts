/**
 * French labels for domain enumerations and error codes. UI copy lives next to components;
 * anything derived from a domain value is centralized here.
 */
import type { ParseDecimalResult } from "@/domain/decimal";
import type { DomainErrorCode } from "@/domain/errors";
import type { MaterialCategory, MovementType, WeighingStatus } from "@/db/schema";

export const STATUS_LABELS: Record<WeighingStatus, string> = {
  open: "En attente",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const STATUS_DESCRIPTIONS: Record<WeighingStatus, string> = {
  open: "Pesée d'entrée enregistrée, tare en attente",
  completed: "Pesée terminée, stock mis à jour",
  cancelled: "Pesée annulée, sans effet sur le stock",
};

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  non_ferrous: "Non ferreux",
  ferrous: "Ferreux",
  stainless: "Inox",
  cables: "Câbles",
  other: "Autres",
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  receipt: "Réception",
  dispatch: "Expédition",
  adjustment: "Ajustement",
};

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  WEIGHT_NOT_INTEGER: "Poids invalide.",
  WEIGHT_NEGATIVE: "Le poids ne peut pas être négatif.",
  WEIGHT_TOO_LARGE: "Poids invraisemblable.",
  TARE_EXCEEDS_GROSS: "La tare ne peut pas dépasser le poids brut.",
  NET_WEIGHT_ZERO: "Le poids net doit être supérieur à zéro.",
  PRICE_NOT_INTEGER: "Prix invalide.",
  PRICE_NEGATIVE: "Le prix ne peut pas être négatif.",
  PRICE_TOO_LARGE: "Prix invraisemblable.",
  AMOUNT_UNSAFE: "Montant hors limites.",
  TARE_MISSING: "La tare est requise pour terminer la pesée.",
  SUPPLIER_MISSING: "Le fournisseur est requis.",
  MATERIAL_MISSING: "La matière est requise.",
  PLATE_MISSING: "L'immatriculation est requise.",
  INVALID_STATUS_TRANSITION: "Cette opération n'est pas possible dans l'état actuel de la pesée.",
  TICKET_NOT_OPEN: "Cette pesée n'est plus en attente.",
  TICKET_NOT_FOUND: "Pesée introuvable.",
  SUPPLIER_NOT_FOUND: "Fournisseur introuvable.",
  MATERIAL_NOT_FOUND: "Matière introuvable.",
  MATERIAL_INACTIVE: "Cette matière est désactivée.",
  SUPPLIER_INACTIVE: "Ce fournisseur est désactivé.",
  QUANTITY_ZERO: "La quantité doit être supérieure à zéro.",
  STOCK_INSUFFICIENT: "La quantité dépasse le stock disponible.",
  DUPLICATE_MATERIAL_CODE: "Ce code matière existe déjà.",
  DUPLICATE_PLATE: "Cette immatriculation existe déjà.",
};

export function parseErrorMessage(
  reason: Extract<ParseDecimalResult, { ok: false }>["reason"],
  kind: "weight" | "price" | "number",
): string {
  switch (reason) {
    case "empty":
      return kind === "weight"
        ? "Indiquez un poids."
        : kind === "price"
          ? "Indiquez un prix."
          : "Valeur requise.";
    case "too_many_decimals":
      return kind === "weight"
        ? "Au maximum 3 décimales (précision du gramme)."
        : kind === "price"
          ? "Trop de décimales pour ce prix."
          : "Trop de décimales.";
    case "unsafe":
      return "Valeur hors limites.";
    case "invalid":
    default:
      return kind === "weight"
        ? "Poids invalide."
        : kind === "price"
          ? "Prix invalide."
          : "Nombre invalide.";
  }
}
