"use client";

import { Plus, Trash2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import type { Vehicle } from "@/db/schema";
import {
  addVehicleAction,
  removeVehicleAction,
  type VehicleFormState,
} from "@/server/actions/suppliers";

interface VehicleManagerProps {
  supplierId: string;
  vehicles: Vehicle[];
}

export function VehicleManager({ supplierId, vehicles }: VehicleManagerProps) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [removing, startRemoving] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<VehicleFormState | null, FormData>(
    async (previous, formData) => {
      const result = await addVehicleAction(supplierId, previous, formData);
      if (result.ok) {
        setFormKey((key) => key + 1);
        router.refresh();
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};

  const remove = (vehicleId: string) => {
    setRemoveError(null);
    startRemoving(async () => {
      const result = await removeVehicleAction(supplierId, vehicleId);
      if (!result.ok) setRemoveError(result.formError ?? "Suppression impossible.");
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {vehicles.length === 0 ? (
        <p className="text-ink-muted text-xs">
          Aucun véhicule enregistré. Les plaques saisies lors des pesées sont ajoutées
          automatiquement.
        </p>
      ) : (
        <ul className="divide-line-soft divide-y">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id} className="flex items-center gap-3 py-1.5 text-sm">
              <Truck className="text-ink-faint size-4 shrink-0" aria-hidden />
              <span className="font-mono font-medium">{vehicle.plateDisplay}</span>
              <span className="text-ink-muted min-w-0 flex-1 truncate text-xs">
                {vehicle.description}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Retirer le véhicule ${vehicle.plateDisplay}`}
                onClick={() => remove(vehicle.id)}
                disabled={removing}
                icon={<Trash2 className="size-3.5" aria-hidden />}
              />
            </li>
          ))}
        </ul>
      )}
      {removeError ? <Notice tone="danger">{removeError}</Notice> : null}
      <form
        key={formKey}
        action={action}
        onSubmit={submitWithoutReset(action)}
        className="border-line-soft flex flex-col gap-2 border-t pt-3"
        noValidate
      >
        {state && !state.ok && state.formError ? (
          <Notice tone="danger">{state.formError}</Notice>
        ) : null}
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <Field label="Plaque" htmlFor="vehicle-plate" error={errors.plate}>
            <Input
              id="vehicle-plate"
              name="plate"
              placeholder="VD 123 456"
              className="font-mono uppercase"
              maxLength={20}
              invalid={Boolean(errors.plate)}
            />
          </Field>
          <Field label="Description" htmlFor="vehicle-description" error={errors.description}>
            <Input
              id="vehicle-description"
              name="description"
              placeholder="Camion benne 3 essieux"
              maxLength={80}
              invalid={Boolean(errors.description)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={pending}
            icon={<Plus className="size-3.5" aria-hidden />}
          >
            Ajouter le véhicule
          </Button>
        </div>
      </form>
    </div>
  );
}
