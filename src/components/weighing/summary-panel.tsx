import type { PriceUnit } from "@/domain/pricing";
import { cn } from "@/lib/cn";
import { formatChf, formatKg, formatUnitPrice } from "@/lib/format";

import type { LiveSummary } from "./live-summary";

interface SummaryPanelProps {
  summary: LiveSummary;
  priceUnit: PriceUnit;
  materialName: string | null;
  /** Message shown under the figures (mode explanation or problem). */
  footnote?: string;
  tone?: "default" | "danger";
}

function Figure({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string | null;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-ink-muted text-xs">{label}</span>
      <span
        className={cn(
          "tnum text-right",
          emphasis ? "text-lg font-semibold" : "text-sm font-medium",
          muted && "text-ink-faint font-normal",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Live figures of a weighing: brut, tare, net, prix, total. Pure display; no state. */
export function SummaryPanel({
  summary,
  priceUnit,
  materialName,
  footnote,
  tone = "default",
}: SummaryPanelProps) {
  return (
    <section
      aria-label="Récapitulatif de la pesée"
      className="panel divide-line-soft divide-y px-4 py-2"
    >
      <Figure
        label="Poids brut"
        value={summary.grossWeightG === null ? null : formatKg(summary.grossWeightG)}
      />
      <Figure
        label="Tare"
        value={summary.tareWeightG === null ? null : formatKg(summary.tareWeightG)}
      />
      <Figure
        label="Poids net"
        value={summary.netWeightG === null ? null : formatKg(summary.netWeightG)}
        emphasis
      />
      <Figure
        label={materialName ? `Prix · ${materialName}` : "Prix d'achat"}
        value={
          summary.unitPriceCtsPerT === null
            ? null
            : formatUnitPrice(summary.unitPriceCtsPerT, priceUnit)
        }
      />
      <Figure
        label="Valeur"
        value={summary.totalAmountCts === null ? null : formatChf(summary.totalAmountCts)}
        emphasis
      />
      {footnote ? (
        <p
          className={cn("py-2 text-xs", tone === "danger" ? "text-danger-text" : "text-ink-muted")}
          role={tone === "danger" ? "alert" : undefined}
        >
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
