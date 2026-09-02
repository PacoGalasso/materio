"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { signInAction, type SignInState } from "@/server/actions/auth";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState | null, FormData>(
    signInAction,
    null,
  );
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="Adresse e-mail" htmlFor="signin-email" required>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          maxLength={254}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="signin-password" required>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} className="mt-1 justify-center">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
