"use client";

import { ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { PriceUnit } from "@/domain/pricing";
import { unitPriceToDisplayDecimal } from "@/domain/pricing";
import { formatKg } from "@/lib/format";
import {
  recordAdjustmentAction,
  recordDispatchAction,
  type MovementFormState,
} from "@/server/actions/inventory";

interface MovementDialogProps {
  mode: "dispatch" | "adjustment";
  materialId: string;
  materialName: string;
  priceUnit: PriceUnit;
  currentPriceCtsPerT: number;
  currentStockG: number;
  defaultDate: string;
  defaultTime: string;
}

function MovementFormBody(props: MovementDialogProps & { onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MovementFormState | null, FormData>(
    async (previous, formData) => {
      const result =
        props.mode === "dispatch"
          ? await recordDispatchAction(props.materialId, previous, formData)
          : await recordAdjustmentAction(props.materialId, previous, formData);
      if (result.ok) {
        props.onDone();
        router.refresh();
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};
  const isDispatch = props.mode === "dispatch";

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state && !state.ok && state.formError ? (
        <Notice tone="danger">{state.formError}</Notice>
      ) : null}
      {isDispatch ? null : (
        <Field label="Sens de la correction" htmlFor="movement-direction" required>
          <Select id="movement-direction" name="direction" defaultValue="add">
            <option value="add">Ajouter au stock (quantité trouvée en plus)</option>
            <option value="remove">Retirer du stock (perte, écart d&apos;inventaire)</option>
          </Select>
        </Field>
      )}
      <Field
        label="Quantité"
        htmlFor="movement-quantity"
        required
        error={errors.quantity}
        hint={`Stock actuel : ${formatKg(props.currentStockG)}`}
      >
        <Input
          id="movement-quantity"
          name="quantity"
          numeric
          suffix="kg"
          autoFocus
          invalid={Boolean(errors.quantity)}
        />
      </Field>
      <Field
        label={isDispatch ? "Prix de vente" : "Valeur unitaire"}
        htmlFor="movement-value"
        required
        error={errors.unitValue}
        hint={`Référence d'achat : ${unitPriceToDisplayDecimal(props.currentPriceCtsPerT, props.priceUnit)} CHF/${props.priceUnit}`}
      >
        <Input
          id="movement-value"
          name="unitValue"
          numeric
          suffix={`CHF/${props.priceUnit}`}
          defaultValue={unitPriceToDisplayDecimal(props.currentPriceCtsPerT, props.priceUnit)}
          invalid={Boolean(errors.unitValue)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="movement-date" required error={errors.date}>
          <Input
            id="movement-date"
            name="date"
            type="date"
            defaultValue={props.defaultDate}
            className="tnum"
            required
          />
        </Field>
        <Field label="Heure" htmlFor="movement-time" required error={errors.time}>
          <Input
            id="movement-time"
            name="time"
            type="time"
            defaultValue={props.defaultTime}
            className="tnum"
            required
          />
        </Field>
      </div>
      <Field
        label={isDispatch ? "Destinataire / bon de livraison" : "Motif"}
        htmlFor="movement-note"
        error={errors.note}
        hint={isDispatch ? "Ex. « Fonderie du Rhône SA · BL-2026-118 »" : undefined}
      >
        <Input id="movement-note" name="note" maxLength={200} invalid={Boolean(errors.note)} />
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" onClick={props.onDone} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {isDispatch ? "Enregistrer l'expédition" : "Enregistrer la correction"}
        </Button>
      </div>
    </form>
  );
}

export function MovementDialog(props: MovementDialogProps) {
  const [open, setOpen] = useState(false);
  const isDispatch = props.mode === "dispatch";
  return (
    <>
      <Button
        variant="secondary"
        icon={
          isDispatch ? (
            <ArrowUpFromLine className="size-4" aria-hidden />
          ) : (
            <SlidersHorizontal className="size-4" aria-hidden />
          )
        }
        onClick={() => setOpen(true)}
        disabled={isDispatch && props.currentStockG <= 0}
      >
        {isDispatch ? "Expédition" : "Correction d'inventaire"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          isDispatch
            ? `Expédition · ${props.materialName}`
            : `Correction d'inventaire · ${props.materialName}`
        }
        description={
          isDispatch
            ? "Sortie de stock vers une fonderie ou un transformateur. La quantité ne peut pas dépasser le stock disponible."
            : "Ajuste le stock sans pesée, par exemple après un inventaire physique."
        }
      >
        {open ? <MovementFormBody {...props} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
