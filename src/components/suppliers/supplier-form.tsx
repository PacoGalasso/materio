"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Supplier } from "@/db/schema";
import {
  createSupplierAction,
  updateSupplierAction,
  type SupplierFormState,
} from "@/server/actions/suppliers";

interface SupplierFormProps {
  supplier?: Supplier;
  /** Called after a successful update (edit dialog). Creation redirects to the new supplier. */
  onDone?: () => void;
}

export function SupplierForm({ supplier, onDone }: SupplierFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SupplierFormState | null, FormData>(
    async (previous, formData) => {
      const result = supplier
        ? await updateSupplierAction(supplier.id, previous, formData)
        : await createSupplierAction(previous, formData);
      if (result.ok && supplier) {
        onDone?.();
        router.refresh();
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Entreprise / nom"
          htmlFor="supplier-name"
          required
          error={errors.name}
          className="md:col-span-2"
        >
          <Input
            id="supplier-name"
            name="name"
            defaultValue={supplier?.name}
            maxLength={120}
            invalid={Boolean(errors.name)}
            autoFocus
          />
        </Field>
        <Field label="Personne de contact" htmlFor="supplier-contact" error={errors.contactName}>
          <Input
            id="supplier-contact"
            name="contactName"
            defaultValue={supplier?.contactName}
            maxLength={120}
            invalid={Boolean(errors.contactName)}
          />
        </Field>
        <Field
          label="N° IDE / TVA"
          htmlFor="supplier-vat"
          error={errors.vatNumber}
          hint="Ex. CHE-123.456.789 TVA"
        >
          <Input
            id="supplier-vat"
            name="vatNumber"
            defaultValue={supplier?.vatNumber}
            maxLength={40}
            className="font-mono"
            invalid={Boolean(errors.vatNumber)}
          />
        </Field>
        <Field label="E-mail" htmlFor="supplier-email" error={errors.email}>
          <Input
            id="supplier-email"
            name="email"
            type="email"
            defaultValue={supplier?.email}
            maxLength={120}
            invalid={Boolean(errors.email)}
          />
        </Field>
        <Field label="Téléphone" htmlFor="supplier-phone" error={errors.phone}>
          <Input
            id="supplier-phone"
            name="phone"
            type="tel"
            defaultValue={supplier?.phone}
            maxLength={40}
            invalid={Boolean(errors.phone)}
          />
        </Field>
        <Field
          label="Rue et numéro"
          htmlFor="supplier-street"
          error={errors.street}
          className="md:col-span-2"
        >
          <Input
            id="supplier-street"
            name="street"
            defaultValue={supplier?.street}
            maxLength={120}
            invalid={Boolean(errors.street)}
          />
        </Field>
        <div className="grid grid-cols-[6rem_1fr_5rem] gap-3 md:col-span-2">
          <Field label="NPA" htmlFor="supplier-postal" error={errors.postalCode}>
            <Input
              id="supplier-postal"
              name="postalCode"
              defaultValue={supplier?.postalCode}
              maxLength={12}
              className="tnum"
              invalid={Boolean(errors.postalCode)}
            />
          </Field>
          <Field label="Localité" htmlFor="supplier-city" error={errors.city}>
            <Input
              id="supplier-city"
              name="city"
              defaultValue={supplier?.city}
              maxLength={80}
              invalid={Boolean(errors.city)}
            />
          </Field>
          <Field label="Canton" htmlFor="supplier-canton" error={errors.canton}>
            <Input
              id="supplier-canton"
              name="canton"
              defaultValue={supplier?.canton}
              maxLength={2}
              className="uppercase"
              invalid={Boolean(errors.canton)}
            />
          </Field>
        </div>
        <Field
          label="Notes"
          htmlFor="supplier-notes"
          error={errors.notes}
          className="md:col-span-2"
        >
          <Textarea
            id="supplier-notes"
            name="notes"
            defaultValue={supplier?.notes}
            rows={3}
            maxLength={2000}
            invalid={Boolean(errors.notes)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={supplier?.isActive ?? true}
          className="accent-ink size-4"
        />
        Fournisseur actif (proposé dans les pesées)
      </label>
      <div className="flex justify-end gap-2">
        {supplier ? (
          <Button type="button" onClick={onDone} disabled={pending}>
            Annuler
          </Button>
        ) : (
          <ButtonLink href="/fournisseurs" variant="ghost">
            Annuler
          </ButtonLink>
        )}
        <Button type="submit" variant="primary" loading={pending}>
          {supplier ? "Enregistrer" : "Créer le fournisseur"}
        </Button>
      </div>
    </form>
  );
}
