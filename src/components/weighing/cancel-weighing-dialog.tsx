"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { cancelWeighingAction, type CancelWeighingState } from "@/server/actions/weighing";

export function CancelWeighingDialog({
  ticketId,
  reference,
}: {
  ticketId: string;
  reference: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CancelWeighingState | null, FormData>(
    async (previous, formData) => {
      const result = await cancelWeighingAction(ticketId, previous, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Button
        variant="danger"
        icon={<Ban className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Annuler la pesée
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Annuler la pesée ${reference}`}
        description="La pesée sera conservée dans l'historique avec le statut « Annulée ». Aucun mouvement de stock ne sera créé."
      >
        <form action={action} onSubmit={submitWithoutReset(action)} className="flex flex-col gap-3">
          {state && !state.ok && state.formError ? (
            <Notice tone="danger">{state.formError}</Notice>
          ) : null}
          <Field
            label="Motif"
            htmlFor="cancel-reason"
            hint="Facultatif, ajouté aux notes de la pesée."
          >
            <Textarea id="cancel-reason" name="reason" rows={2} maxLength={500} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)} disabled={pending}>
              Conserver la pesée
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Confirmer l&apos;annulation
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
