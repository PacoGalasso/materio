"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { serverEnv } from "@/env/server";
import { requireOrgContext } from "@/server/context";
import { resetDemoWorkspace, updateOrganization, updateYard } from "@/server/use-cases/settings";
import { formString } from "@/server/validation/form";
import { parseOrganizationForm, parseYardForm } from "@/server/validation/settings";

import { failure, failureFromError, type ActionResult } from "./result";

export type SettingsFormState = ActionResult<undefined>;

export async function updateOrganizationAction(
  _previous: SettingsFormState | null,
  formData: FormData,
): Promise<SettingsFormState> {
  const { organization, user } = await requireOrgContext("MANAGE_ORGANIZATION_SETTINGS");
  const db = await getDb();
  const parsed = parseOrganizationForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateOrganization(db, organization.id, user.id, parsed.value);
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
  const { organization, yard, user } = await requireOrgContext("MANAGE_ORGANIZATION_SETTINGS");
  const db = await getDb();
  const parsed = parseYardForm(formData);
  if (!parsed.ok) return failure(parsed.fieldErrors);
  try {
    await updateYard(db, organization.id, yard.id, user.id, parsed.value);
  } catch (error) {
    return failureFromError(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export type ResetDemoState = ActionResult<{ tickets: number; movements: number }>;

const RESET_CONFIRMATION = "RÉINITIALISER";

/**
 * Demo-only tooling: rebuilds the seeded demo dataset. Refused outright in production
 * (checked first, before authentication even matters) and requires OWNER even in
 * development — this must never be reachable against real customer data.
 */
export async function resetDemoAction(
  _previous: ResetDemoState | null,
  formData: FormData,
): Promise<ResetDemoState> {
  if (serverEnv().NODE_ENV === "production") {
    return failure({}, "Cette action n'est pas disponible en production.");
  }
  await requireOrgContext("RESET_DEMO_DATA");
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
