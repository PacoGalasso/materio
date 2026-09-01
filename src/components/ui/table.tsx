import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Scroll container: wide tables scroll inside, never the page. */
export function TableScroller({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-muted sticky top-0 z-10", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-line-soft divide-y", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("group", className)} {...props} />;
}

interface CellProps {
  align?: "left" | "right" | "center";
  numeric?: boolean;
}

export function Th({ className, align, numeric, ...props }: ComponentProps<"th"> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        "label-caps border-line h-9 border-b px-3 text-left font-medium whitespace-nowrap",
        (align === "right" || numeric) && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, align, numeric, ...props }: ComponentProps<"td"> & CellProps) {
  return (
    <td
      className={cn(
        "h-9 px-3 py-1.5 align-middle whitespace-nowrap",
        (align === "right" || numeric) && "tnum text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** Row hover style for clickable rows (apply on <Tr>). */
export const rowLinkClasses = "hover:bg-surface-muted transition-colors duration-75";
