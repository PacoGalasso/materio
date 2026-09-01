import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-ink-muted flex flex-col items-center justify-center text-center",
        compact ? "gap-1 px-4 py-8" : "gap-2 px-6 py-14",
        className,
      )}
    >
      {icon ? <div className="text-ink-faint mb-1">{icon}</div> : null}
      <p className="text-ink-secondary text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
