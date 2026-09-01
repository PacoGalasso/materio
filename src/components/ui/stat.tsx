import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface StatProps {
  label: string;
  value: ReactNode;
  /** Secondary line: count, comparison, hint. */
  detail?: ReactNode;
  tone?: "default" | "warning" | "positive";
  className?: string;
}

/** Key figure with an aligned numeric value. Meant for a bordered row, not floating cards. */
export function Stat({ label, value, detail, tone = "default", className }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 px-5 py-4", className)}>
      <span className="label-caps">{label}</span>
      <span
        className={cn(
          "tnum truncate text-2xl leading-none font-semibold",
          tone === "warning" && "text-warning-text",
          tone === "positive" && "text-positive-text",
        )}
      >
        {value}
      </span>
      {detail ? <span className="text-ink-muted truncate text-xs">{detail}</span> : null}
    </div>
  );
}

/** Label/value pair for detail sheets. */
export function DataRow({
  label,
  children,
  numeric,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="text-ink-muted shrink-0 text-xs">{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm", numeric && "tnum")}>{children}</dd>
    </div>
  );
}
