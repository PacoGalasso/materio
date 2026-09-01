"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { getWorkspace } from "@/server/context";
import { getMaterial } from "@/server/queries/materials";
import { recordAdjustment, recordDispatch } from "@/server/use-cases/inventory";
import { formString } from "@/server/validation/form";
import { parseMovementForm } from "@/server/validation/inventory";

import { failure, failureFromError, type ActionResult } from "./result";

export type MovementFormState = ActionResult<{ id: string }>;

function revalidateInventory(materialId: string): void {
  revalidatePath("/");
  revalidatePath("/stock");
  revalidatePath("/matieres");
  revalidatePath(`/matieres/${materialId}`);
}

/** Secondary flow: material leaving the yard (shipment to a smelter or processor). */
export async function recordDispatchAction(
  materialId: string,
  _previous: MovementFormState | null,
  formData: FormData,
): Promise<MovementFormState> {
  const { organization, yard } = await getWorkspace();
  const db = await getDb();
  const material = await getMaterial(organization.id, materialId);
  if (!material) return failure({}, "Matière introuvable.");
  const parsed = parseMovementForm(formData, material.priceUnit);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    const result = await recordDispatch(db, organization.id, yard.id, {
      materialId,
      ...parsed.value,
    });
    revalidateInventory(materialId);
    return { ok: true, data: result };
  } catch (error) {
    return failureFromError(error, { quantity: "quantity", unitValue: "unitValue" });
  }
}

/** Inventory count correction; the sign is chosen in the form. */
export async function recordAdjustmentAction(
  materialId: string,
  _previous: MovementFormState | null,
  formData: FormData,
): Promise<MovementFormState> {
  const { organization, yard } = await getWorkspace();
  const db = await getDb();
  const material = await getMaterial(organization.id, materialId);
  if (!material) return failure({}, "Matière introuvable.");
  const parsed = parseMovementForm(formData, material.priceUnit);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  const direction = formString(formData, "direction") === "remove" ? -1 : 1;
  try {
    const result = await recordAdjustment(db, organization.id, yard.id, {
      materialId,
      ...parsed.value,
      quantityG: direction * parsed.value.quantityG,
    });
    revalidateInventory(materialId);
    return { ok: true, data: result };
  } catch (error) {
    return failureFromError(error, { quantity: "quantity", unitValue: "unitValue" });
  }
}
