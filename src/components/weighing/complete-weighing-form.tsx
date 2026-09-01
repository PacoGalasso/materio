"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import type { PriceUnit } from "@/domain/pricing";
import { unitPriceToDisplayDecimal } from "@/domain/pricing";
import { formatKgValue } from "@/lib/format";
import { DOMAIN_ERROR_MESSAGES } from "@/lib/labels";
import { completeWeighingAction, type CompleteWeighingState } from "@/server/actions/weighing";

import { computeLiveSummary } from "./live-summary";
import { SummaryPanel } from "./summary-panel";

interface CompleteWeighingFormProps {
  ticketId: string;
  grossWeightG: number;
  unitPriceCtsPerT: number;
  referencePriceCtsPerT: number;
  priceUnit: PriceUnit;
  materialName: string;
  notes: string;
  defaultDate: string;
  defaultTime: string;
}

export function CompleteWeighingForm({
  ticketId,
  grossWeightG,
  unitPriceCtsPerT,
  referencePriceCtsPerT,
  priceUnit,
  materialName,
  notes,
  defaultDate,
  defaultTime,
}: CompleteWeighingFormProps) {
  const boundAction = completeWeighingAction.bind(null, ticketId);
  const [state, action, pending] = useActionState<CompleteWeighingState | null, FormData>(
    boundAction,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};

  const [tareKg, setTareKg] = useState("");
  const [price, setPrice] = useState(unitPriceToDisplayDecimal(unitPriceCtsPerT, priceUnit));
  const summary = computeLiveSummary({
    grossKg: formatKgValue(grossWeightG, { maxFraction: 3 }),
    tareKg,
    price,
    priceUnit,
  });

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
      <Field label="Tare (sortie)" htmlFor="tareWeight" required error={errors.tareWeight}>
        <Input
          id="tareWeight"
          name="tareWeight"
          numeric
          suffix="kg"
          autoFocus
          value={tareKg}
          onChange={(event) => setTareKg(event.target.value)}
          placeholder="6 870"
          invalid={Boolean(errors.tareWeight) || summary.issue !== null}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="tareDate" required error={errors.tareDate}>
          <Input
            id="tareDate"
            name="tareDate"
            type="date"
            defaultValue={defaultDate}
            required
            className="tnum"
          />
        </Field>
        <Field label="Heure de sortie" htmlFor="tareTime" required error={errors.tareTime}>
          <Input
            id="tareTime"
            name="tareTime"
            type="time"
            defaultValue={defaultTime}
            required
            className="tnum"
          />
        </Field>
      </div>
      <Field
        label="Prix d'achat confirmé"
        htmlFor="unitPrice"
        required
        error={errors.unitPrice}
        hint={`Référence actuelle : ${unitPriceToDisplayDecimal(referencePriceCtsPerT, priceUnit)} CHF/${priceUnit}`}
      >
        <Input
          id="unitPrice"
          name="unitPrice"
          numeric
          suffix={`CHF/${priceUnit}`}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          invalid={Boolean(errors.unitPrice)}
        />
      </Field>
      <Field label="Notes" htmlFor="notes" error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={notes}
          rows={2}
          maxLength={1000}
          invalid={Boolean(errors.notes)}
        />
      </Field>

      <SummaryPanel
        summary={summary}
        priceUnit={priceUnit}
        materialName={materialName}
        footnote={summary.issue ? DOMAIN_ERROR_MESSAGES[summary.issue] : undefined}
        tone={summary.issue ? "danger" : "default"}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={pending}
        disabled={summary.issue !== null}
      >
        Terminer la pesée
      </Button>
    </form>
  );
}
