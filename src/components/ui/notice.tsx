import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { className: string; Icon: typeof Info }> = {
  info: { className: "bg-accent-soft text-accent-text border-accent/30", Icon: Info },
  success: {
    className: "bg-positive-soft text-positive-text border-positive/30",
    Icon: CircleCheck,
  },
  warning: {
    className: "bg-warning-soft text-warning-text border-warning/30",
    Icon: TriangleAlert,
  },
  danger: { className: "bg-danger-soft text-danger-text border-danger/30", Icon: CircleAlert },
};

/** Inline message block; always carries an icon so tone is never colour-only. */
export function Notice({
  tone = "info",
  children,
  className,
  role,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { className: styles, Icon } = TONES[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn(
        "flex items-start gap-2 rounded-sm border px-3 py-2 text-sm",
        styles,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
