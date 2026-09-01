"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { createSupplierQuickAction, type QuickSupplierState } from "@/server/actions/weighing";

interface QuickSupplierDialogProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string; city: string }) => void;
}

export function QuickSupplierDialog({
  open,
  initialName,
  onClose,
  onCreated,
}: QuickSupplierDialogProps) {
  const [state, action, pending] = useActionState<QuickSupplierState | null, FormData>(
    async (previous, formData) => {
      const result = await createSupplierQuickAction(previous, formData);
      if (result.ok) onCreated(result.data);
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : {};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouveau fournisseur"
      description="Création rapide depuis la pesée. Les coordonnées complètes peuvent être ajoutées plus tard."
    >
      <form action={action} className="flex flex-col gap-3">
        {state && !state.ok && state.formError ? (
          <Notice tone="danger">{state.formError}</Notice>
        ) : null}
        <Field
          label="Nom de l'entreprise"
          htmlFor="quick-supplier-name"
          required
          error={errors.name}
        >
          <Input
            id="quick-supplier-name"
            name="name"
            defaultValue={initialName}
            key={initialName}
            autoFocus
            invalid={Boolean(errors.name)}
            maxLength={120}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Localité" htmlFor="quick-supplier-city" error={errors.city}>
            <Input
              id="quick-supplier-city"
              name="city"
              invalid={Boolean(errors.city)}
              maxLength={80}
            />
          </Field>
          <Field label="Téléphone" htmlFor="quick-supplier-phone" error={errors.phone}>
            <Input
              id="quick-supplier-phone"
              name="phone"
              type="tel"
              invalid={Boolean(errors.phone)}
              maxLength={40}
            />
          </Field>
        </div>
        <Field
          label="Personne de contact"
          htmlFor="quick-supplier-contact"
          error={errors.contactName}
        >
          <Input
            id="quick-supplier-contact"
            name="contactName"
            invalid={Boolean(errors.contactName)}
            maxLength={120}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Créer le fournisseur
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
