import Link from "next/link";

import { MaterialName } from "@/components/ui/category-swatch";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { formatAmount, formatDateTime, formatKgValue, formatUnitPriceValue } from "@/lib/format";
import type { TicketRow, TicketSortKey } from "@/server/queries/tickets";

import { SortableHeader, type SortState } from "./sortable-header";

export const TICKET_SORT_DEFAULT_DIR: Record<TicketSortKey, "asc" | "desc"> = {
  date: "desc",
  reference: "desc",
  supplier: "asc",
  material: "asc",
  net: "desc",
  total: "desc",
  status: "asc",
};

interface TicketTableProps {
  rows: TicketRow[];
  /** Enables sortable column headers driven by URL search params. */
  sort?: SortState<TicketSortKey>;
  /** Hide columns for compact embeds (dashboard, supplier page). */
  compact?: boolean;
  /** Omit the supplier column when every row belongs to the same supplier. */
  hideSupplier?: boolean;
}

function Cell({ value, dash = "—" }: { value: string | null; dash?: string }) {
  return value === null ? <span className="text-ink-faint">{dash}</span> : <>{value}</>;
}

export function TicketTable({
  rows,
  sort,
  compact = false,
  hideSupplier = false,
}: TicketTableProps) {
  const header = (key: TicketSortKey, label: string, numeric?: boolean) =>
    sort ? (
      <SortableHeader sortKey={key} state={sort} numeric={numeric}>
        {label}
      </SortableHeader>
    ) : (
      label
    );

  return (
    <TableScroller>
      <Table>
        <THead>
          <tr>
            <Th>{header("reference", "Référence")}</Th>
            <Th>{header("date", "Date")}</Th>
            {hideSupplier ? null : <Th>{header("supplier", "Fournisseur")}</Th>}
            {compact ? null : <Th>Véhicule</Th>}
            <Th>{header("material", "Matière")}</Th>
            {compact ? null : <Th numeric>Brut (kg)</Th>}
            {compact ? null : <Th numeric>Tare (kg)</Th>}
            <Th numeric>{header("net", "Net (kg)", true)}</Th>
            <Th numeric>Prix</Th>
            <Th numeric>{header("total", "Total (CHF)", true)}</Th>
            <Th>{header("status", "Statut")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.id} className={`${rowLinkClasses} relative`}>
              <Td className="font-mono text-xs font-medium">
                <Link
                  href={`/pesees/${row.id}`}
                  className="text-ink after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-offset-[-2px]"
                >
                  {row.reference}
                </Link>
              </Td>
              <Td className="tnum text-ink-secondary">{formatDateTime(row.grossWeighedAt)}</Td>
              {hideSupplier ? null : <Td className="max-w-56 truncate">{row.supplierName}</Td>}
              {compact ? null : <Td className="font-mono text-xs">{row.plateSnapshot}</Td>}
              <Td>
                <MaterialName name={row.materialName} category={row.materialCategory} />
              </Td>
              {compact ? null : <Td numeric>{formatKgValue(row.grossWeightG)}</Td>}
              {compact ? null : (
                <Td numeric>
                  <Cell value={row.tareWeightG === null ? null : formatKgValue(row.tareWeightG)} />
                </Td>
              )}
              <Td numeric className="font-medium">
                <Cell value={row.netWeightG === null ? null : formatKgValue(row.netWeightG)} />
              </Td>
              <Td numeric className="text-ink-secondary">
                {formatUnitPriceValue(row.unitPriceCtsPerT, row.priceUnit)}
                <span className="text-ink-faint">/{row.priceUnit}</span>
              </Td>
              <Td numeric className="font-medium">
                <Cell
                  value={row.totalAmountCts === null ? null : formatAmount(row.totalAmountCts)}
                />
              </Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableScroller>
  );
}
