import {
  formatDayShort,
  formatKg,
  formatScaled,
  formatWeekdayShort,
  formatWeight,
} from "@/lib/format";
import { dayKey } from "@/lib/time";
import type { DailyActivity } from "@/server/queries/dashboard";

interface ActivityChartProps {
  activity: DailyActivity[];
  now: Date;
}

const TICKS = 4;

function niceCeiling(maxG: number): number {
  if (maxG <= 0) return 1_000_000;
  const magnitude = 10 ** Math.floor(Math.log10(maxG));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  return candidates.find((c) => c >= maxG) ?? maxG;
}

/**
 * Daily inbound vs outbound tonnage, 14 days. Two series (fixed hue order) rendered as
 * HTML bars so labels stay crisp at any width; each bar carries a native tooltip and the
 * figures are also listed in the accessible table below the chart.
 */
export function ActivityChart({ activity, now }: ActivityChartProps) {
  const max = niceCeiling(Math.max(...activity.map((d) => Math.max(d.receivedG, d.dispatchedG))));
  const today = dayKey(now);
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max * (TICKS - i)) / TICKS);
  const inTonnes = max >= 10_000_000;
  const tickLabel = (grams: number) =>
    inTonnes
      ? `${formatScaled(grams, 6, { minFraction: 0, maxFraction: 1 })} t`
      : formatKg(grams, { maxFraction: 0 });
  const totalReceived = activity.reduce((sum, d) => sum + d.receivedG, 0);
  const totalDispatched = activity.reduce((sum, d) => sum + d.dispatchedG, 0);

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-in inline-block size-2.5 rounded-xs" aria-hidden />
            Réceptions
            <span className="tnum text-ink-muted">{formatWeight(totalReceived)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-out inline-block size-2.5 rounded-xs" aria-hidden />
            Expéditions
            <span className="tnum text-ink-muted">{formatWeight(totalDispatched)}</span>
          </span>
        </div>
        <span className="text-ink-muted text-xs">14 derniers jours · poids net par jour</span>
      </div>

      <div className="flex gap-2" aria-hidden>
        {/* Y axis */}
        <div className="tnum text-ink-faint relative h-40 w-12 shrink-0 text-2xs">
          {ticks.map((tick, i) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ top: `${(i / TICKS) * 100}%` }}
            >
              {tickLabel(tick)}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative h-40 flex-1">
          {ticks.map((tick, i) => (
            <div
              key={tick}
              className="bg-chart-grid absolute inset-x-0 h-px"
              style={{ top: `${(i / TICKS) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 grid grid-cols-14 gap-1 sm:gap-2">
            {activity.map((day) => (
              <div key={day.key} className="flex items-end justify-center gap-0.5 px-0.5">
                <div
                  className="bg-chart-in w-full max-w-6 rounded-t-[3px]"
                  style={{ height: `${(day.receivedG / max) * 100}%` }}
                  title={`${formatDayShort(day.day)} · Réceptions ${formatKg(day.receivedG, { maxFraction: 0 })} (${day.receipts} pesées)`}
                />
                <div
                  className="bg-chart-out w-full max-w-6 rounded-t-[3px]"
                  style={{ height: `${(day.dispatchedG / max) * 100}%` }}
                  title={`${formatDayShort(day.day)} · Expéditions ${formatKg(day.dispatchedG, { maxFraction: 0 })}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* X axis */}
      <div className="mt-1.5 flex gap-2" aria-hidden>
        <div className="w-12 shrink-0" />
        <div className="grid flex-1 grid-cols-14 gap-1 sm:gap-2">
          {activity.map((day, index) => (
            <div
              key={day.key}
              className={`text-center text-2xs leading-tight ${day.key === today ? "text-ink font-medium" : "text-ink-muted"} ${index % 2 === 1 ? "invisible sm:visible" : ""}`}
            >
              <div>{formatWeekdayShort(day.day)}</div>
              <div className="tnum hidden sm:block">{formatDayShort(day.day)}</div>
            </div>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Poids reçus et expédiés par jour, 14 derniers jours</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Réceptions</th>
            <th scope="col">Expéditions</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((day) => (
            <tr key={day.key}>
              <th scope="row">{formatDayShort(day.day)}</th>
              <td>{formatKg(day.receivedG, { maxFraction: 0 })}</td>
              <td>{formatKg(day.dispatchedG, { maxFraction: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
