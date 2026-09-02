"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";

import { failure, type ActionResult } from "./result";

export type SignInState = ActionResult<undefined>;

const GENERIC_SIGN_IN_ERROR = "Adresse e-mail ou mot de passe incorrect.";

export async function signInAction(
  _previous: SignInState | null,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !password) {
    return failure({}, GENERIC_SIGN_IN_ERROR);
  }

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    // Never distinguish "unknown email" from "wrong password" — both look identical here.
    return failure({}, GENERIC_SIGN_IN_ERROR);
  }
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/connexion");
}
