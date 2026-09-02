import { Boxes } from "lucide-react";
import Link from "next/link";

import { MovementTable } from "@/components/inventory/movement-table";
import { SortableHeader, type SortState } from "@/components/tickets/sortable-header";
import type { SearchParams } from "@/components/tickets/ticket-query";
import { MaterialName } from "@/components/ui/category-swatch";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Tag } from "@/components/ui/status-badge";
import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  TableScroller,
  rowLinkClasses,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import {
  countLabel,
  formatAmount,
  formatChf,
  formatKgValue,
  formatRelativeDateTime,
  formatUnitPriceValue,
  formatWeight,
} from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getOrgContext } from "@/server/context";
import { getStockOverview, listMovements, type StockLine } from "@/server/queries/inventory";

export const metadata = { title: "Stock" };

const SORT_KEYS = ["name", "quantity", "value", "movement"] as const;
type StockSortKey = (typeof SORT_KEYS)[number];
const DEFAULT_DIR: Record<StockSortKey, "asc" | "desc"> = {
  name: "asc",
  quantity: "desc",
  value: "desc",
  movement: "desc",
};

function sortLines(lines: StockLine[], sort: StockSortKey, dir: "asc" | "desc"): StockLine[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...lines].sort((a, b) => {
    switch (sort) {
      case "name":
        return factor * a.name.localeCompare(b.name, "fr");
      case "quantity":
        return factor * (a.quantityG - b.quantityG);
      case "movement":
        return factor * ((a.lastMovementAt?.getTime() ?? 0) - (b.lastMovementAt?.getTime() ?? 0));
      case "value":
      default:
        return factor * (a.valueCts - b.valueCts);
    }
  });
}

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { organization, yard } = await getOrgContext();
  const query = await searchParams;
  const sortRaw = Array.isArray(query.tri) ? query.tri[0] : query.tri;
  const sort: StockSortKey = (SORT_KEYS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as StockSortKey)
    : "value";
  const dir: "asc" | "desc" =
    (Array.isArray(query.sens) ? query.sens[0] : query.sens) === "asc" ? "asc" : "desc";
  const now = new Date();
  const [stock, movements] = await Promise.all([
    getStockOverview(organization.id, now),
    listMovements(organization.id, { limit: 12 }),
  ]);
  const lines = sortLines(stock.lines, sort, dir);
  const inStock = stock.lines.filter((line) => line.quantityG > 0).length;
  const sortState: SortState<StockSortKey> = {
    sort,
    dir,
    params: new URLSearchParams(),
    pathname: "/stock",
    defaultDir: DEFAULT_DIR,
  };

  return (
    <>
      <PageHeader
        title="Stock"
        context={`${yard.name} · valorisation au prix d'achat de référence`}
      />
      <div className="flex flex-col gap-5 p-5">
        <section
          aria-label="Synthèse du stock"
          className="panel divide-line-soft grid grid-cols-1 sm:grid-cols-3 sm:divide-x"
        >
          <Stat
            label="Valeur estimée"
            value={formatChf(stock.totalValueCts)}
            detail="au prix d'achat de référence"
          />
          <Stat
            label="Quantité totale"
            value={formatWeight(stock.totalQuantityG)}
            detail={countLabel(inStock, "matière en stock", "matières en stock")}
          />
          <Stat
            label="Matières suivies"
            value={String(stock.lines.filter((l) => l.isActive).length)}
            detail={`${stock.lines.filter((l) => !l.isActive).length} désactivée(s)`}
          />
        </section>

        <section className="panel">
          {lines.length === 0 ? (
            <EmptyState
              icon={<Boxes className="size-6" />}
              title="Aucune matière"
              description="Créez des matières pour suivre le stock."
            />
          ) : (
            <TableScroller>
              <Table>
                <THead>
                  <tr>
                    <Th>
                      <SortableHeader sortKey="name" state={sortState}>
                        Matière
                      </SortableHeader>
                    </Th>
                    <Th>Catégorie</Th>
                    <Th numeric>
                      <SortableHeader sortKey="quantity" state={sortState} numeric>
                        Quantité (kg)
                      </SortableHeader>
                    </Th>
                    <Th numeric>Prix de réf.</Th>
                    <Th numeric>
                      <SortableHeader sortKey="value" state={sortState} numeric>
                        Valeur estimée (CHF)
                      </SortableHeader>
                    </Th>
                    <Th numeric>7 jours</Th>
                    <Th>
                      <SortableHeader sortKey="movement" state={sortState}>
                        Dernier mouvement
                      </SortableHeader>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {lines.map((line) => (
                    <Tr
                      key={line.materialId}
                      className={cn(rowLinkClasses, "relative", !line.isActive && "text-ink-muted")}
                    >
                      <Td>
                        <Link
                          href={`/matieres/${line.materialId}`}
                          className="after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          <MaterialName name={line.name} category={line.category} />
                        </Link>
                        {!line.isActive ? <Tag className="ml-2">Désactivée</Tag> : null}
                      </Td>
                      <Td className="text-ink-secondary">{CATEGORY_LABELS[line.category]}</Td>
                      <Td numeric className="font-medium">
                        {formatKgValue(line.quantityG)}
                      </Td>
                      <Td numeric className="text-ink-secondary">
                        {formatUnitPriceValue(line.referencePriceCtsPerT, line.priceUnit)}
                        <span className="text-ink-faint">/{line.priceUnit}</span>
                      </Td>
                      <Td numeric className="font-medium">
                        {formatAmount(line.valueCts)}
                      </Td>
                      <Td numeric className="text-xs">
                        <span className="text-positive-text">
                          +{formatKgValue(line.receivedLast7dG)}
                        </span>
                        <span className="text-ink-faint"> / </span>
                        <span className="text-ink-secondary">
                          −{formatKgValue(line.dispatchedLast7dG)}
                        </span>
                      </Td>
                      <Td className="tnum text-ink-secondary">
                        {line.lastMovementAt ? (
                          formatRelativeDateTime(line.lastMovementAt, now)
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          )}
        </section>

        <section className="panel">
          <div className="border-line-soft border-b px-4 py-3">
            <SectionTitle trailing="12 derniers mouvements, toutes matières">
              Mouvements récents
            </SectionTitle>
          </div>
          <MovementTable rows={movements} />
        </section>
      </div>
    </>
  );
}
