import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "border-line-strong bg-surface text-ink-muted inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-xs border px-1 font-sans text-2xs font-medium",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
