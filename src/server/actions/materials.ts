"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { getWorkspace } from "@/server/context";
import { getMaterial } from "@/server/queries/materials";
import { createMaterial, updateMaterial, updateMaterialPrice } from "@/server/use-cases/materials";
import { formString, parsePrice } from "@/server/validation/form";
import { parseMaterialForm, parsePriceForm } from "@/server/validation/materials";

import { failure, failureFromError, type ActionResult } from "./result";

function revalidateMaterials(materialId?: string): void {
  revalidatePath("/");
  revalidatePath("/matieres");
  revalidatePath("/stock");
  revalidatePath("/pesees/nouvelle");
  if (materialId) revalidatePath(`/matieres/${materialId}`);
}

export type MaterialFormState = ActionResult<{ id: string }>;

export async function createMaterialAction(
  _previous: MaterialFormState | null,
  formData: FormData,
): Promise<MaterialFormState> {
  const { organization } = await getWorkspace();
  const db = await getDb();
  const parsed = parseMaterialForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  const price = parsePrice(formString(formData, "price"), parsed.value.priceUnit);
  if (!price.ok) return failure({ price: price.message });

  let created: { id: string };
  try {
    created = await createMaterial(db, organization.id, {
      ...parsed.value,
      initialPriceCtsPerT: price.value,
    });
  } catch (error) {
    return failureFromError(error);
  }
  revalidateMaterials();
  redirect(`/matieres/${created.id}`);
}

export async function updateMaterialAction(
  materialId: string,
  _previous: MaterialFormState | null,
  formData: FormData,
): Promise<MaterialFormState> {
  const { organization } = await getWorkspace();
  const db = await getDb();
  const parsed = parseMaterialForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateMaterial(db, organization.id, materialId, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidateMaterials(materialId);
  return { ok: true, data: { id: materialId } };
}

export type PriceFormState = ActionResult<{ id: string }>;

export async function updateMaterialPriceAction(
  materialId: string,
  _previous: PriceFormState | null,
  formData: FormData,
): Promise<PriceFormState> {
  const { organization } = await getWorkspace();
  const db = await getDb();
  const material = await getMaterial(organization.id, materialId);
  if (!material) return failure({}, "Matière introuvable.");
  const parsed = parsePriceForm(formData, material.priceUnit);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateMaterialPrice(db, organization.id, materialId, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidateMaterials(materialId);
  return { ok: true, data: { id: materialId } };
}
