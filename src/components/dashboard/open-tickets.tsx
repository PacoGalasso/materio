import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";

import { MaterialName } from "@/components/ui/category-swatch";
import { EmptyState } from "@/components/ui/empty-state";
import { formatKgValue, formatRelativeDateTime } from "@/lib/format";
import type { TicketRow } from "@/server/queries/tickets";

export function OpenTicketsList({ tickets, now }: { tickets: TicketRow[]; now: Date }) {
  if (tickets.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CircleCheck className="size-5" />}
        title="Aucune pesée en attente"
        description="Toutes les pesées d'entrée ont reçu leur tare."
      />
    );
  }
  return (
    <ul className="divide-line-soft divide-y">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/pesees/${ticket.id}`}
            className="hover:bg-surface-muted grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-sm transition-colors duration-75 sm:grid-cols-[6.5rem_1fr_auto]"
          >
            <span className="col-span-2 flex flex-row items-baseline gap-2 sm:col-span-1 sm:flex-col sm:gap-0">
              <span className="font-mono text-xs font-medium">{ticket.reference}</span>
              <span className="text-ink-muted tnum text-2xs">
                {formatRelativeDateTime(ticket.grossWeighedAt, now)}
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{ticket.supplierName}</span>
              <span className="text-ink-muted flex flex-wrap items-center gap-x-2 text-xs">
                <span className="font-mono">{ticket.plateSnapshot}</span>
                <MaterialName name={ticket.materialName} category={ticket.materialCategory} />
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="flex flex-col items-end">
                <span className="tnum font-medium">{formatKgValue(ticket.grossWeightG)} kg</span>
                <span className="text-ink-muted text-2xs">brut · tare à saisir</span>
              </span>
              <ArrowRight className="text-ink-faint size-4" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
