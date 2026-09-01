import Link from "next/link";

import { CategorySwatch } from "@/components/ui/category-swatch";
import { formatChf, formatPercent, formatWeight } from "@/lib/format";
import type { StockLine } from "@/server/queries/inventory";

interface StockValueChartProps {
  lines: StockLine[];
  totalValueCts: number;
  limit?: number;
}

/**
 * "Which materials tie up the most value?" — a single-series horizontal bar list, sorted,
 * with the remainder folded into "Autres matières". Values are direct-labelled.
 */
export function StockValueChart({ lines, totalValueCts, limit = 7 }: StockValueChartProps) {
  const sorted = [...lines]
    .filter((line) => line.valueCts > 0)
    .sort((a, b) => b.valueCts - a.valueCts);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restValue = rest.reduce((sum, line) => sum + line.valueCts, 0);
  const max = top[0]?.valueCts ?? 1;

  if (top.length === 0) {
    return <p className="text-ink-muted text-xs">Aucune valeur en stock.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {top.map((line) => (
        <li
          key={line.materialId}
          className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs"
        >
          <Link
            href={`/matieres/${line.materialId}`}
            className="flex min-w-0 items-center gap-2 hover:underline"
            title={`${line.name} · ${formatWeight(line.quantityG)} en stock`}
          >
            <CategorySwatch category={line.category} />
            <span className="truncate">{line.name}</span>
          </Link>
          <div className="bg-surface-sunken h-3 rounded-xs" aria-hidden>
            <div
              className="bg-chart-in h-full rounded-xs"
              style={{ width: `${Math.max(1.5, (line.valueCts / max) * 100)}%` }}
            />
          </div>
          <span className="tnum w-28 text-right">
            {formatChf(line.valueCts)}
            <span className="text-ink-faint ml-1">
              {totalValueCts > 0 ? formatPercent(line.valueCts / totalValueCts) : ""}
            </span>
          </span>
        </li>
      ))}
      {rest.length > 0 ? (
        <li className="text-ink-muted grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate">Autres matières ({rest.length})</span>
          <div className="bg-surface-sunken h-3 rounded-xs" aria-hidden>
            <div
              className="bg-ink-faint h-full rounded-xs"
              style={{ width: `${(restValue / max) * 100}%` }}
            />
          </div>
          <span className="tnum w-28 text-right">{formatChf(restValue)}</span>
        </li>
      ) : null}
    </ol>
  );
}
