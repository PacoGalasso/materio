"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { requireOrgContext } from "@/server/context";
import {
  addSupplierVehicle,
  createSupplier,
  removeSupplierVehicle,
  updateSupplier,
} from "@/server/use-cases/suppliers";
import { fieldErrorsFromZod, formString } from "@/server/validation/form";
import { parseSupplierForm, vehicleSchema } from "@/server/validation/suppliers";

import { failure, failureFromError, type ActionResult } from "./result";

function revalidateSuppliers(supplierId?: string): void {
  revalidatePath("/fournisseurs");
  revalidatePath("/pesees/nouvelle");
  if (supplierId) revalidatePath(`/fournisseurs/${supplierId}`);
}

export type SupplierFormState = ActionResult<{ id: string }>;

export async function createSupplierAction(
  _previous: SupplierFormState | null,
  formData: FormData,
): Promise<SupplierFormState> {
  const { organization, user } = await requireOrgContext("MANAGE_SUPPLIERS");
  const db = await getDb();
  const parsed = parseSupplierForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  let created: { id: string };
  try {
    created = await createSupplier(db, organization.id, user.id, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidateSuppliers();
  redirect(`/fournisseurs/${created.id}`);
}

export async function updateSupplierAction(
  supplierId: string,
  _previous: SupplierFormState | null,
  formData: FormData,
): Promise<SupplierFormState> {
  const { organization, user } = await requireOrgContext("MANAGE_SUPPLIERS");
  const db = await getDb();
  const parsed = parseSupplierForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateSupplier(db, organization.id, supplierId, user.id, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidateSuppliers(supplierId);
  return { ok: true, data: { id: supplierId } };
}

export type VehicleFormState = ActionResult<{ id: string }>;

export async function addVehicleAction(
  supplierId: string,
  _previous: VehicleFormState | null,
  formData: FormData,
): Promise<VehicleFormState> {
  const { organization } = await requireOrgContext("MANAGE_SUPPLIERS");
  const db = await getDb();
  const parsed = vehicleSchema.safeParse({
    plate: formString(formData, "plate"),
    description: formString(formData, "description"),
  });
  if (!parsed.success) return failure(fieldErrorsFromZod(parsed.error));
  try {
    const result = await addSupplierVehicle(db, organization.id, supplierId, parsed.data);
    revalidateSuppliers(supplierId);
    return { ok: true, data: result };
  } catch (error) {
    return failureFromError(error);
  }
}

export async function removeVehicleAction(
  supplierId: string,
  vehicleId: string,
): Promise<ActionResult<undefined>> {
  const { organization } = await requireOrgContext("MANAGE_SUPPLIERS");
  const db = await getDb();
  try {
    await removeSupplierVehicle(db, organization.id, vehicleId);
    revalidateSuppliers(supplierId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failureFromError(error);
  }
}
