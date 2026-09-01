import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  /** Context line under the title (yard, date, count…). */
  context?: ReactNode;
  /** Optional element rendered before the title (e.g. back link). */
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Contextual top header of a workspace page. */
export function PageHeader({ title, context, leading, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "bg-surface border-line print-hidden sticky top-0 z-20 flex min-h-12 items-center gap-4 border-b px-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-semibold">{title}</h1>
          {context ? <p className="text-ink-muted truncate text-xs">{context}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section title inside the workspace (h2). */
export function SectionTitle({
  children,
  trailing,
  className,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold">{children}</h2>
      {trailing ? <div className="text-ink-muted text-xs">{trailing}</div> : null}
    </div>
  );
}
