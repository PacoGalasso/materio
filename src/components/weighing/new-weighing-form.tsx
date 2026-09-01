"use client";

import { useActionState, useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitWithoutReset } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import type { MaterialCategory, PriceUnit } from "@/db/schema";
import { unitPriceToDisplayDecimal } from "@/domain/pricing";
import { CATEGORY_LABELS, DOMAIN_ERROR_MESSAGES } from "@/lib/labels";
import { createWeighingAction, type CreateWeighingState } from "@/server/actions/weighing";
import type { SupplierOption } from "@/server/queries/suppliers";

import { computeLiveSummary } from "./live-summary";
import { QuickSupplierDialog } from "./quick-supplier-dialog";
import { SummaryPanel } from "./summary-panel";

export interface MaterialOption {
  id: string;
  name: string;
  code: string;
  category: MaterialCategory;
  priceUnit: PriceUnit;
  currentPurchasePriceCtsPerT: number;
}

interface NewWeighingFormProps {
  suppliers: SupplierOption[];
  materials: MaterialOption[];
  defaultDate: string;
  defaultTime: string;
  /** Preselected supplier (e.g. coming from the supplier page). */
  initialSupplierId?: string | null;
}

export function NewWeighingForm({
  suppliers: initialSuppliers,
  materials,
  defaultDate,
  defaultTime,
  initialSupplierId = null,
}: NewWeighingFormProps) {
  const [state, action, pending] = useActionState<CreateWeighingState | null, FormData>(
    createWeighingAction,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : {};

  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState<string | null>(
    initialSuppliers.some((s) => s.id === initialSupplierId) ? initialSupplierId : null,
  );
  const [plate, setPlate] = useState("");
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [grossKg, setGrossKg] = useState("");
  const [tareKg, setTareKg] = useState("");
  const [createDialog, setCreateDialog] = useState<{ open: boolean; name: string }>({
    open: false,
    name: "",
  });

  const supplierOptions = useMemo<ComboboxOption[]>(
    () => suppliers.map((s) => ({ id: s.id, label: s.name, description: s.city || undefined })),
    [suppliers],
  );
  const materialOptions = useMemo<ComboboxOption[]>(
    () =>
      materials.map((m) => ({
        id: m.id,
        label: m.name,
        description: `${CATEGORY_LABELS[m.category]} · ${m.code}`,
        keywords: m.code,
      })),
    [materials],
  );

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const material = materials.find((m) => m.id === materialId) ?? null;
  const priceUnit: PriceUnit = material?.priceUnit ?? "kg";

  const summary = computeLiveSummary({ grossKg, tareKg, price, priceUnit });
  const complete = tareKg.trim().length > 0;
  const footnote = summary.issue
    ? DOMAIN_ERROR_MESSAGES[summary.issue]
    : complete
      ? "Pesée complète : la réception sera comptabilisée en stock immédiatement."
      : "Pesée d'entrée : la tare sera saisie au départ du véhicule, depuis la fiche de la pesée.";

  const handleMaterialChange = (id: string | null) => {
    setMaterialId(id);
    const next = materials.find((m) => m.id === id);
    if (next) setPrice(unitPriceToDisplayDecimal(next.currentPurchasePriceCtsPerT, next.priceUnit));
  };

  return (
    <>
      <form
        action={action}
        onSubmit={submitWithoutReset(action)}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
        noValidate
      >
        <div className="flex flex-col gap-5">
          {state && !state.ok && state.formError ? (
            <Notice tone="danger">{state.formError}</Notice>
          ) : null}

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Arrivée du véhicule</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fournisseur" htmlFor="supplierId" required error={errors.supplierId}>
                <Combobox
                  id="supplierId"
                  name="supplierId"
                  options={supplierOptions}
                  value={supplierId}
                  onChange={(id) => setSupplierId(id)}
                  placeholder="Rechercher un fournisseur…"
                  invalid={Boolean(errors.supplierId)}
                  autoFocus
                  onCreate={(name) => setCreateDialog({ open: true, name })}
                  createLabel={(q) => `Créer le fournisseur « ${q} »`}
                />
              </Field>
              <Field
                label="Immatriculation"
                htmlFor="plate"
                required
                error={errors.plate}
                hint={
                  supplier && supplier.vehicles.length > 0
                    ? "Véhicules connus proposés en saisie."
                    : undefined
                }
              >
                <Input
                  id="plate"
                  name="plate"
                  list="plate-suggestions"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value)}
                  placeholder="VD 123 456"
                  className="font-mono uppercase"
                  invalid={Boolean(errors.plate)}
                  autoComplete="off"
                  maxLength={20}
                />
                <datalist id="plate-suggestions">
                  {supplier?.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.plateDisplay}>
                      {vehicle.description || undefined}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Date" htmlFor="grossDate" required error={errors.grossDate}>
                <Input
                  id="grossDate"
                  name="grossDate"
                  type="date"
                  defaultValue={defaultDate}
                  required
                  className="tnum"
                />
              </Field>
              <Field label="Heure d'entrée" htmlFor="grossTime" required error={errors.grossTime}>
                <Input
                  id="grossTime"
                  name="grossTime"
                  type="time"
                  defaultValue={defaultTime}
                  required
                  className="tnum"
                />
              </Field>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Matière et pesée</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Matière"
                htmlFor="materialId"
                required
                error={errors.materialId}
                className="md:col-span-2"
              >
                <Combobox
                  id="materialId"
                  name="materialId"
                  options={materialOptions}
                  value={materialId}
                  onChange={handleMaterialChange}
                  placeholder="Rechercher une matière…"
                  invalid={Boolean(errors.materialId)}
                />
              </Field>
              <Field
                label="Prix d'achat"
                htmlFor="unitPrice"
                required
                error={errors.unitPrice}
                hint={
                  material
                    ? `Prix de référence : ${unitPriceToDisplayDecimal(material.currentPurchasePriceCtsPerT, material.priceUnit)} CHF/${material.priceUnit}`
                    : "Rempli automatiquement selon la matière."
                }
              >
                <Input
                  id="unitPrice"
                  name="unitPrice"
                  numeric
                  suffix={`CHF/${priceUnit}`}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder={priceUnit === "kg" ? "6.15" : "185.00"}
                  invalid={Boolean(errors.unitPrice)}
                />
              </Field>
              <Field
                label="Poids brut (entrée)"
                htmlFor="grossWeight"
                required
                error={errors.grossWeight}
              >
                <Input
                  id="grossWeight"
                  name="grossWeight"
                  numeric
                  suffix="kg"
                  value={grossKg}
                  onChange={(event) => setGrossKg(event.target.value)}
                  placeholder="8 420"
                  invalid={Boolean(errors.grossWeight)}
                />
              </Field>
              <Field
                label="Tare (sortie)"
                htmlFor="tareWeight"
                error={errors.tareWeight}
                hint="Facultatif à l'entrée. Renseignez-la si le véhicule a déjà été pesé à vide."
              >
                <Input
                  id="tareWeight"
                  name="tareWeight"
                  numeric
                  suffix="kg"
                  value={tareKg}
                  onChange={(event) => setTareKg(event.target.value)}
                  placeholder="6 870"
                  invalid={Boolean(errors.tareWeight) || summary.issue !== null}
                />
              </Field>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Informations complémentaires</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Référence externe"
                htmlFor="externalReference"
                error={errors.externalReference}
                hint="Bon de livraison, numéro de commande…"
              >
                <Input
                  id="externalReference"
                  name="externalReference"
                  maxLength={60}
                  invalid={Boolean(errors.externalReference)}
                />
              </Field>
              <Field label="Notes" htmlFor="notes" error={errors.notes} className="md:col-span-2">
                <Textarea
                  id="notes"
                  name="notes"
                  maxLength={1000}
                  rows={2}
                  invalid={Boolean(errors.notes)}
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-16 xl:self-start">
          <SummaryPanel
            summary={summary}
            priceUnit={priceUnit}
            materialName={material?.name ?? null}
            footnote={footnote}
            tone={summary.issue ? "danger" : "default"}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            disabled={summary.issue !== null}
          >
            {complete ? "Terminer la pesée" : "Enregistrer la pesée d'entrée"}
          </Button>
          <ButtonLink href="/pesees" variant="ghost" size="md">
            Abandonner
          </ButtonLink>
        </aside>
      </form>

      <QuickSupplierDialog
        open={createDialog.open}
        initialName={createDialog.name}
        onClose={() => setCreateDialog({ open: false, name: "" })}
        onCreated={(created) => {
          setSuppliers((list) =>
            [...list, { ...created, vehicles: [] }].sort((a, b) =>
              a.name.localeCompare(b.name, "fr"),
            ),
          );
          setSupplierId(created.id);
          setCreateDialog({ open: false, name: "" });
        }}
      />
    </>
  );
}
