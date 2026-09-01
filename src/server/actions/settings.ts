"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { getWorkspace } from "@/server/context";
import { resetDemoWorkspace, updateOrganization, updateYard } from "@/server/use-cases/settings";
import { formString } from "@/server/validation/form";
import { parseOrganizationForm, parseYardForm } from "@/server/validation/settings";

import { failure, failureFromError, type ActionResult } from "./result";

export type SettingsFormState = ActionResult<undefined>;

export async function updateOrganizationAction(
  _previous: SettingsFormState | null,
  formData: FormData,
): Promise<SettingsFormState> {
  const { organization } = await getWorkspace();
  const db = await getDb();
  const parsed = parseOrganizationForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateOrganization(db, organization.id, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function updateYardAction(
  _previous: SettingsFormState | null,
  formData: FormData,
): Promise<SettingsFormState> {
  const { organization, yard } = await getWorkspace();
  const db = await getDb();
  const parsed = parseYardForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateYard(db, organization.id, yard.id, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export type ResetDemoState = ActionResult<{ tickets: number; movements: number }>;

const RESET_CONFIRMATION = "RÉINITIALISER";

export async function resetDemoAction(
  _previous: ResetDemoState | null,
  formData: FormData,
): Promise<ResetDemoState> {
  if (formString(formData, "confirmation").toUpperCase() !== RESET_CONFIRMATION) {
    return failure({ confirmation: `Saisissez ${RESET_CONFIRMATION} pour confirmer.` });
  }
  const db = await getDb();
  try {
    const summary = await resetDemoWorkspace(db);
    revalidatePath("/", "layout");
    return { ok: true, data: { tickets: summary.tickets, movements: summary.movements } };
  } catch (error) {
    return failureFromError(error);
  }
}
