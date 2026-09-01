"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Organization, Yard } from "@/db/schema";
import {
  resetDemoAction,
  updateOrganizationAction,
  updateYardAction,
  type ResetDemoState,
  type SettingsFormState,
} from "@/server/actions/settings";

export function OrganizationForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SettingsFormState | null, FormData>(
    async (previous, formData) => {
      const result = await updateOrganizationAction(previous, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok ? (
        <Notice tone="success">Informations de l&apos;entreprise enregistrées.</Notice>
      ) : null}
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nom usuel" htmlFor="org-name" required error={errors.name}>
          <Input
            id="org-name"
            name="name"
            defaultValue={organization.name}
            maxLength={120}
            invalid={Boolean(errors.name)}
          />
        </Field>
        <Field
          label="Raison sociale"
          htmlFor="org-legal"
          required
          error={errors.legalName}
          hint="Imprimée sur les bulletins de pesée."
        >
          <Input
            id="org-legal"
            name="legalName"
            defaultValue={organization.legalName}
            maxLength={160}
            invalid={Boolean(errors.legalName)}
          />
        </Field>
        <Field
          label="Rue et numéro"
          htmlFor="org-street"
          error={errors.street}
          className="md:col-span-2"
        >
          <Input
            id="org-street"
            name="street"
            defaultValue={organization.street}
            maxLength={120}
            invalid={Boolean(errors.street)}
          />
        </Field>
        <div className="grid grid-cols-[6rem_1fr_5rem] gap-3 md:col-span-2">
          <Field label="NPA" htmlFor="org-postal" error={errors.postalCode}>
            <Input
              id="org-postal"
              name="postalCode"
              defaultValue={organization.postalCode}
              maxLength={12}
              className="tnum"
              invalid={Boolean(errors.postalCode)}
            />
          </Field>
          <Field label="Localité" htmlFor="org-city" error={errors.city}>
            <Input
              id="org-city"
              name="city"
              defaultValue={organization.city}
              maxLength={80}
              invalid={Boolean(errors.city)}
            />
          </Field>
          <Field label="Canton" htmlFor="org-canton" error={errors.canton}>
            <Input
              id="org-canton"
              name="canton"
              defaultValue={organization.canton}
              maxLength={2}
              className="uppercase"
              invalid={Boolean(errors.canton)}
            />
          </Field>
        </div>
        <Field label="N° IDE / TVA" htmlFor="org-vat" error={errors.vatNumber}>
          <Input
            id="org-vat"
            name="vatNumber"
            defaultValue={organization.vatNumber}
            maxLength={40}
            className="font-mono"
            invalid={Boolean(errors.vatNumber)}
          />
        </Field>
        <Field
          label="Préfixe des références"
          htmlFor="org-prefix"
          required
          error={errors.ticketPrefix}
          hint={`Prochaine référence : ${organization.ticketPrefix}-${new Date().getFullYear()}-${String(organization.nextTicketNumber).padStart(5, "0")}`}
        >
          <Input
            id="org-prefix"
            name="ticketPrefix"
            defaultValue={organization.ticketPrefix}
            maxLength={6}
            className="font-mono uppercase"
            invalid={Boolean(errors.ticketPrefix)}
          />
        </Field>
        <Field label="Téléphone" htmlFor="org-phone" error={errors.phone}>
          <Input
            id="org-phone"
            name="phone"
            type="tel"
            defaultValue={organization.phone}
            maxLength={40}
            invalid={Boolean(errors.phone)}
          />
        </Field>
        <Field label="E-mail" htmlFor="org-email" error={errors.email}>
          <Input
            id="org-email"
            name="email"
            type="email"
            defaultValue={organization.email}
            maxLength={120}
            invalid={Boolean(errors.email)}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function YardForm({ yard }: { yard: Yard }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SettingsFormState | null, FormData>(
    async (previous, formData) => {
      const result = await updateYardAction(previous, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok ? <Notice tone="success">Site enregistré.</Notice> : null}
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Nom du site" htmlFor="yard-name" required error={errors.name}>
          <Input
            id="yard-name"
            name="name"
            defaultValue={yard.name}
            maxLength={80}
            invalid={Boolean(errors.name)}
          />
        </Field>
        <Field label="Code" htmlFor="yard-code" required error={errors.code}>
          <Input
            id="yard-code"
            name="code"
            defaultValue={yard.code}
            maxLength={8}
            className="font-mono uppercase"
            invalid={Boolean(errors.code)}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function ResetDemoBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ResetDemoState | null, FormData>(
    async (previous, formData) => {
      const result = await resetDemoAction(previous, formData);
      if (result.ok) {
        router.refresh();
        onDone();
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      <Notice tone="warning">
        Toutes les pesées, mouvements de stock, fournisseurs et matières actuels seront supprimés et
        remplacés par le jeu de démonstration daté d&apos;aujourd&apos;hui.
      </Notice>
      <Field
        label="Saisissez RÉINITIALISER pour confirmer"
        htmlFor="reset-confirmation"
        required
        error={errors.confirmation}
      >
        <Input
          id="reset-confirmation"
          name="confirmation"
          autoFocus
          autoComplete="off"
          invalid={Boolean(errors.confirmation)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="danger" loading={pending}>
          Réinitialiser les données
        </Button>
      </div>
    </form>
  );
}

export function ResetDemoDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="danger"
        icon={<RotateCcw className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Réinitialiser les données de démonstration
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Réinitialiser l'espace de démonstration"
      >
        {open ? <ResetDemoBody onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
