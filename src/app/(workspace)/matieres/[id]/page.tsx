import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MovementDialog } from "@/components/inventory/movement-dialog";
import { MovementTable } from "@/components/inventory/movement-table";
import { MaterialFormDialog } from "@/components/materials/material-form-dialog";
import { PriceFormDialog } from "@/components/materials/price-form-dialog";
import { CategorySwatch } from "@/components/ui/category-swatch";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tag } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr, TableScroller } from "@/components/ui/table";
import {
  countLabel,
  formatChf,
  formatDate,
  formatKg,
  formatUnitPrice,
  formatUnitPriceValue,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getWorkspace } from "@/server/context";
import { getMaterialStockG, listMovements } from "@/server/queries/inventory";
import { getMaterial, getMaterialActivity, listPriceHistory } from "@/server/queries/materials";
import { stockValueCts } from "@/domain/inventory";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const { organization } = await getWorkspace();
  const material = await getMaterial(organization.id, id);
  return { title: material?.name ?? "Matière" };
}

export default async function MaterialPage({ params }: PageProps) {
  const { id } = await params;
  const { organization } = await getWorkspace();
  const material = await getMaterial(organization.id, id);
  if (!material) notFound();

  const now = new Date();
  const [stockG, activity, prices, movements] = await Promise.all([
    getMaterialStockG(material.id),
    getMaterialActivity(material.id, now),
    listPriceHistory(material.id),
    listMovements(organization.id, { materialId: material.id, limit: 100 }),
  ]);
  const valueCts = stockValueCts(stockG, material.currentPurchasePriceCtsPerT);

  return (
    <>
      <PageHeader
        leading={
          <Link
            href="/matieres"
            className="text-ink-muted hover:text-ink flex size-7 items-center justify-center rounded-sm"
            aria-label="Retour aux matières"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            <CategorySwatch category={material.category} />
            {material.name}
            {!material.isActive ? <Tag>Désactivée</Tag> : null}
          </span>
        }
        context={`${material.code} · ${CATEGORY_LABELS[material.category]} · prix affiché en CHF/${material.priceUnit}`}
        actions={
          <>
            <MovementDialog
              mode="adjustment"
              materialId={material.id}
              materialName={material.name}
              priceUnit={material.priceUnit}
              currentPriceCtsPerT={material.currentPurchasePriceCtsPerT}
              currentStockG={stockG}
              defaultDate={toDateInputValue(now)}
              defaultTime={toTimeInputValue(now)}
            />
            <MovementDialog
              mode="dispatch"
              materialId={material.id}
              materialName={material.name}
              priceUnit={material.priceUnit}
              currentPriceCtsPerT={material.currentPurchasePriceCtsPerT}
              currentStockG={stockG}
              defaultDate={toDateInputValue(now)}
              defaultTime={toTimeInputValue(now)}
            />
            <MaterialFormDialog material={material} />
            <PriceFormDialog
              materialId={material.id}
              materialName={material.name}
              priceUnit={material.priceUnit}
              currentPriceCtsPerT={material.currentPurchasePriceCtsPerT}
              defaultDate={toDateInputValue(now)}
            />
          </>
        }
      />

      <div className="flex flex-col gap-5 p-5">
        <section
          aria-label="Situation de la matière"
          className="panel divide-line-soft grid grid-cols-2 md:grid-cols-4 md:divide-x"
        >
          <Stat
            label="Stock actuel"
            value={formatKg(stockG)}
            detail={`valeur estimée ${formatChf(valueCts)}`}
          />
          <Stat
            label="Prix d'achat de référence"
            value={formatUnitPrice(material.currentPurchasePriceCtsPerT, material.priceUnit)}
            detail={prices[0] ? `depuis le ${formatDate(prices[0].effectiveFrom)}` : undefined}
          />
          <Stat
            label="Reçu sur 30 jours"
            value={formatKg(activity.receivedLast30dG)}
            detail={`${countLabel(activity.receiptsLast30d, "réception")} · ${formatChf(activity.purchasedLast30dCts)}`}
          />
          <Stat
            label="Prix moyen payé (30 j)"
            value={
              activity.averagePurchasePriceLast30dCtsPerT === null
                ? "—"
                : formatUnitPrice(activity.averagePurchasePriceLast30dCtsPerT, material.priceUnit)
            }
            detail={`expédié ${formatKg(activity.dispatchedLast30dG)}`}
          />
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="panel">
            <div className="border-line-soft border-b px-4 py-3">
              <SectionTitle trailing={countLabel(movements.length, "mouvement")}>
                Mouvements de stock
              </SectionTitle>
            </div>
            <MovementTable rows={movements} showMaterial={false} />
          </section>

          <section className="panel max-w-2xl self-start 2xl:max-w-none">
            <div className="border-line-soft border-b px-4 py-3">
              <SectionTitle>Historique des prix</SectionTitle>
            </div>
            <TableScroller>
              <Table>
                <THead>
                  <tr>
                    <Th>Dès le</Th>
                    <Th numeric>Prix (CHF/{material.priceUnit})</Th>
                    <Th>Motif</Th>
                  </tr>
                </THead>
                <TBody>
                  {prices.map((price, index) => (
                    <Tr key={price.id}>
                      <Td className="tnum">{formatDate(price.effectiveFrom)}</Td>
                      <Td numeric className={index === 0 ? "font-semibold" : undefined}>
                        {formatUnitPriceValue(price.purchasePriceCtsPerT, material.priceUnit)}
                      </Td>
                      <Td className="text-ink-secondary max-w-48 truncate">
                        {price.note || <span className="text-ink-faint">—</span>}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          </section>
        </div>
      </div>
    </>
  );
}
