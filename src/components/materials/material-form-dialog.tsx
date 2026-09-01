"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { MATERIAL_CATEGORIES, type Material } from "@/db/schema";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  createMaterialAction,
  updateMaterialAction,
  type MaterialFormState,
} from "@/server/actions/materials";

interface MaterialFormDialogProps {
  /** When provided the dialog edits this material, otherwise it creates one. */
  material?: Material;
}

function MaterialFormBody({ material, onDone }: { material?: Material; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MaterialFormState | null, FormData>(
    async (previous, formData) => {
      const result = material
        ? await updateMaterialAction(material.id, previous, formData)
        : await createMaterialAction(previous, formData);
      if (result.ok) {
        onDone();
        router.refresh();
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-3"
      noValidate
    >
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label="Code" htmlFor="material-code" required error={errors.code} hint="Ex. CU-MIX">
          <Input
            id="material-code"
            name="code"
            defaultValue={material?.code}
            className="font-mono uppercase"
            maxLength={12}
            invalid={Boolean(errors.code)}
            autoFocus
          />
        </Field>
        <Field label="Nom" htmlFor="material-name" required error={errors.name}>
          <Input
            id="material-name"
            name="name"
            defaultValue={material?.name}
            maxLength={80}
            invalid={Boolean(errors.name)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie" htmlFor="material-category" required error={errors.category}>
          <Select
            id="material-category"
            name="category"
            defaultValue={material?.category ?? "non_ferrous"}
            invalid={Boolean(errors.category)}
          >
            {MATERIAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Unité de prix"
          htmlFor="material-unit"
          required
          error={errors.priceUnit}
          hint="Affichage uniquement ; le stockage est identique."
        >
          <Select
            id="material-unit"
            name="priceUnit"
            defaultValue={material?.priceUnit ?? "kg"}
            invalid={Boolean(errors.priceUnit)}
          >
            <option value="kg">CHF par kg</option>
            <option value="t">CHF par tonne</option>
          </Select>
        </Field>
      </div>
      {material ? null : (
        <Field
          label="Prix d'achat initial"
          htmlFor="material-price"
          required
          error={errors.price}
          hint="Dans l'unité choisie ci-dessus."
        >
          <Input
            id="material-price"
            name="price"
            numeric
            suffix="CHF"
            placeholder="6.15"
            invalid={Boolean(errors.price)}
          />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={material?.isActive ?? true}
          className="accent-ink size-4"
        />
        Matière active (proposée dans les pesées)
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {material ? "Enregistrer" : "Créer la matière"}
        </Button>
      </div>
    </form>
  );
}

export function MaterialFormDialog({ material }: MaterialFormDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={material ? "secondary" : "primary"}
        icon={
          material ? (
            <Pencil className="size-4" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )
        }
        onClick={() => setOpen(true)}
      >
        {material ? "Modifier" : "Nouvelle matière"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={material ? `Modifier ${material.name}` : "Nouvelle matière"}
        description={
          material
            ? undefined
            : "Le prix pourra être ajusté à tout moment ; chaque changement est historisé."
        }
      >
        {open ? <MaterialFormBody material={material} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
