import { Ban, CircleCheck, Clock } from "lucide-react";

import type { MovementType, WeighingStatus } from "@/db/schema";
import { cn } from "@/lib/cn";
import { MOVEMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";

const STATUS_STYLES: Record<WeighingStatus, { className: string; Icon: typeof Clock }> = {
  open: { className: "bg-warning-soft text-warning-text border-warning/30", Icon: Clock },
  completed: {
    className: "bg-positive-soft text-positive-text border-positive/30",
    Icon: CircleCheck,
  },
  cancelled: { className: "bg-surface-sunken text-ink-muted border-line-strong", Icon: Ban },
};

const BADGE =
  "inline-flex h-5 items-center gap-1 rounded-xs border px-1.5 text-2xs font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: WeighingStatus; className?: string }) {
  const { className: styles, Icon } = STATUS_STYLES[status];
  return (
    <span className={cn(BADGE, styles, className)}>
      <Icon className="size-3" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const MOVEMENT_STYLES: Record<MovementType, string> = {
  receipt: "bg-positive-soft text-positive-text border-positive/30",
  dispatch: "bg-accent-soft text-accent-text border-accent/30",
  adjustment: "bg-surface-sunken text-ink-secondary border-line-strong",
};

export function MovementBadge({ type, className }: { type: MovementType; className?: string }) {
  return (
    <span className={cn(BADGE, MOVEMENT_STYLES[type], className)}>
      {MOVEMENT_TYPE_LABELS[type]}
    </span>
  );
}

/** Neutral tag for secondary information (e.g. "Prix démo", "Inactif"). */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(BADGE, "bg-surface-muted text-ink-muted border-line", className)}>
      {children}
    </span>
  );
}
