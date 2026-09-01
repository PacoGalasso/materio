"use client";

import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import type { PriceUnit } from "@/domain/pricing";
import { unitPriceToDisplayDecimal } from "@/domain/pricing";
import { updateMaterialPriceAction, type PriceFormState } from "@/server/actions/materials";

interface PriceFormDialogProps {
  materialId: string;
  materialName: string;
  priceUnit: PriceUnit;
  currentPriceCtsPerT: number;
  defaultDate: string;
}

function PriceFormBody({
  materialId,
  priceUnit,
  currentPriceCtsPerT,
  defaultDate,
  onDone,
}: PriceFormDialogProps & { onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PriceFormState | null, FormData>(
    async (previous, formData) => {
      const result = await updateMaterialPriceAction(materialId, previous, formData);
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
      <Field
        label="Nouveau prix d'achat"
        htmlFor="price-value"
        required
        error={errors.price}
        hint={`Prix actuel : ${unitPriceToDisplayDecimal(currentPriceCtsPerT, priceUnit)} CHF/${priceUnit}`}
      >
        <Input
          id="price-value"
          name="price"
          numeric
          suffix={`CHF/${priceUnit}`}
          defaultValue={unitPriceToDisplayDecimal(currentPriceCtsPerT, priceUnit)}
          autoFocus
          invalid={Boolean(errors.price)}
        />
      </Field>
      <Field label="Applicable dès le" htmlFor="price-date" required error={errors.effectiveDate}>
        <Input
          id="price-date"
          name="effectiveDate"
          type="date"
          defaultValue={defaultDate}
          className="tnum"
          required
        />
      </Field>
      <Field
        label="Motif"
        htmlFor="price-note"
        error={errors.note}
        hint="Ex. « Alignement marché », « Accord fournisseur »."
      >
        <Input id="price-note" name="note" maxLength={200} invalid={Boolean(errors.note)} />
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Enregistrer le prix
        </Button>
      </div>
    </form>
  );
}

export function PriceFormDialog(props: PriceFormDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        icon={<Tag className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Modifier le prix
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Prix d'achat · ${props.materialName}`}
        description="Le nouveau prix devient la référence pour les prochaines pesées et la valorisation du stock. L'historique est conservé."
      >
        {open ? <PriceFormBody {...props} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
