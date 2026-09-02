"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { requireOrgContext } from "@/server/context";
import { getMaterial } from "@/server/queries/materials";
import { getTicketDetail } from "@/server/queries/tickets";
import { createSupplier, EMPTY_SUPPLIER_INPUT } from "@/server/use-cases/suppliers";
import {
  cancelWeighingTicket,
  completeWeighingTicket,
  createWeighingTicket,
} from "@/server/use-cases/weighing";
import { formString, shortTextSchema } from "@/server/validation/form";
import { supplierSchema } from "@/server/validation/suppliers";
import { parseCompletionForm, parseWeighingForm } from "@/server/validation/weighing";

import { failure, failureFromError, type ActionResult } from "./result";

const WEIGHING_FIELD_MAP = {
  grossWeight: "grossWeight",
  tareWeight: "tareWeight",
  unitPrice: "unitPrice",
  supplierId: "supplierId",
  materialId: "materialId",
  plate: "plate",
};

function revalidateOperations(): void {
  revalidatePath("/");
  revalidatePath("/pesees");
  revalidatePath("/stock");
  revalidatePath("/matieres");
  revalidatePath("/fournisseurs");
}

export type CreateWeighingState = ActionResult<{ id: string }>;

export async function createWeighingAction(
  _previous: CreateWeighingState | null,
  formData: FormData,
): Promise<CreateWeighingState> {
  const { organization, yard, user } = await requireOrgContext("OPERATE_WEIGHING");
  const db = await getDb();

  const materialId = formString(formData, "materialId");
  const material = materialId ? await getMaterial(organization.id, materialId) : null;
  if (!material) return failure({ materialId: "Sélectionnez une matière." });

  const parsed = parseWeighingForm(formData, material.priceUnit);
  if (!parsed.ok) return failure(parsed.fieldErrors);

  let created: { id: string };
  try {
    created = await createWeighingTicket(db, organization.id, yard.id, user.id, parsed.value);
  } catch (error) {
    return failureFromError(error, WEIGHING_FIELD_MAP);
  }
  revalidateOperations();
  redirect(`/pesees/${created.id}?enregistree=1`);
}

export type CompleteWeighingState = ActionResult<{ id: string }>;

export async function completeWeighingAction(
  ticketId: string,
  _previous: CompleteWeighingState | null,
  formData: FormData,
): Promise<CompleteWeighingState> {
  const { organization, user } = await requireOrgContext("OPERATE_WEIGHING");
  const db = await getDb();
  const detail = await getTicketDetail(organization.id, ticketId);
  if (!detail) return failure({}, "Pesée introuvable.");

  const parsed = parseCompletionForm(formData, detail.material.priceUnit);
  if (!parsed.ok) return failure(parsed.fieldErrors);

  try {
    await completeWeighingTicket(db, organization.id, ticketId, user.id, parsed.value);
  } catch (error) {
    return failureFromError(error, WEIGHING_FIELD_MAP);
  }
  revalidateOperations();
  revalidatePath(`/pesees/${ticketId}`);
  redirect(`/pesees/${ticketId}?terminee=1`);
}

export type CancelWeighingState = ActionResult<{ id: string }>;

export async function cancelWeighingAction(
  ticketId: string,
  _previous: CancelWeighingState | null,
  formData: FormData,
): Promise<CancelWeighingState> {
  const { organization, user } = await requireOrgContext("OPERATE_WEIGHING");
  const db = await getDb();
  const reason = shortTextSchema(500).safeParse(formString(formData, "reason"));
  if (!reason.success)
    return failure({ reason: reason.error.issues[0]?.message ?? "Motif invalide." });
  try {
    await cancelWeighingTicket(db, organization.id, ticketId, user.id, reason.data);
  } catch (error) {
    return failureFromError(error);
  }
  revalidateOperations();
  revalidatePath(`/pesees/${ticketId}`);
  return { ok: true, data: { id: ticketId } };
}

export type QuickSupplierState = ActionResult<{ id: string; name: string; city: string }>;

/** Creates a supplier from the weighing form without leaving it. */
export async function createSupplierQuickAction(
  _previous: QuickSupplierState | null,
  formData: FormData,
): Promise<QuickSupplierState> {
  const { organization, user } = await requireOrgContext("MANAGE_SUPPLIERS");
  const db = await getDb();
  const parsed = supplierSchema.safeParse({
    ...EMPTY_SUPPLIER_INPUT,
    name: formString(formData, "name"),
    contactName: formString(formData, "contactName"),
    phone: formString(formData, "phone"),
    city: formString(formData, "city"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return failure({
      [first?.path.map(String).join(".") || "name"]: first?.message ?? "Données invalides.",
    });
  }
  try {
    const supplier = await createSupplier(db, organization.id, user.id, parsed.data);
    revalidatePath("/fournisseurs");
    return { ok: true, data: { id: supplier.id, name: supplier.name, city: supplier.city } };
  } catch (error) {
    return failureFromError(error);
  }
}
