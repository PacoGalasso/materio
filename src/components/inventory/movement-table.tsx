import Link from "next/link";

import { MaterialName } from "@/components/ui/category-swatch";
import { EmptyState } from "@/components/ui/empty-state";
import { MovementBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr, TableScroller } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatAmount, formatDateTime, formatKgValue, formatUnitPriceValue } from "@/lib/format";
import type { MovementRow } from "@/server/queries/inventory";

interface MovementTableProps {
  rows: MovementRow[];
  /** Hide the material column when the table is scoped to one material. */
  showMaterial?: boolean;
}

function describe(row: MovementRow): string {
  if (row.type === "receipt")
    return row.supplierName ? `Réception · ${row.supplierName}` : "Réception";
  return row.note || (row.type === "dispatch" ? "Expédition" : "Ajustement");
}

export function MovementTable({ rows, showMaterial = true }: MovementTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title="Aucun mouvement de stock"
        description="Les réceptions et expéditions apparaîtront ici."
      />
    );
  }
  return (
    <TableScroller>
      <Table>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Type</Th>
            {showMaterial ? <Th>Matière</Th> : null}
            <Th>Détail</Th>
            <Th>Pesée</Th>
            <Th numeric>Qté (kg)</Th>
            <Th numeric>Prix unit.</Th>
            <Th numeric>Montant (CHF)</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="tnum text-ink-secondary">{formatDateTime(row.occurredAt)}</Td>
              <Td>
                <MovementBadge type={row.type} />
              </Td>
              {showMaterial ? (
                <Td>
                  <Link href={`/matieres/${row.materialId}`} className="hover:underline">
                    <MaterialName name={row.materialName} category={row.materialCategory} />
                  </Link>
                </Td>
              ) : null}
              <Td className="max-w-72 truncate">{describe(row)}</Td>
              <Td className="font-mono text-xs">
                {row.ticketId && row.ticketReference ? (
                  <Link href={`/pesees/${row.ticketId}`} className="hover:underline">
                    {row.ticketReference}
                  </Link>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </Td>
              <Td
                numeric
                className={cn(
                  "font-medium",
                  row.quantityG < 0 ? "text-ink-secondary" : "text-positive-text",
                )}
              >
                {row.quantityG > 0 ? "+" : "−"}
                {formatKgValue(Math.abs(row.quantityG))}
              </Td>
              <Td numeric className="text-ink-secondary">
                {formatUnitPriceValue(row.unitValueCtsPerT, row.priceUnit)}
                <span className="text-ink-faint">/{row.priceUnit}</span>
              </Td>
              <Td numeric className={cn(row.amountCts < 0 && "text-ink-secondary")}>
                {row.amountCts < 0 ? "−" : ""}
                {formatAmount(Math.abs(row.amountCts))}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableScroller>
  );
}
