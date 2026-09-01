import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SortState<K extends string> {
  sort: K;
  dir: "asc" | "desc";
  /** Current search params, so sorting keeps filters intact. */
  params: URLSearchParams;
  pathname: string;
  /** Direction used when a column is first activated. */
  defaultDir: Record<K, "asc" | "desc">;
  /** Query keys used for sort and direction (default: tri / sens). */
  keys?: { sort: string; dir: string };
}

interface SortableHeaderProps<K extends string> {
  sortKey: K;
  state: SortState<K>;
  numeric?: boolean;
  children: ReactNode;
}

/** Column header rendered as a link: sorting is a URL change, so it works without JavaScript. */
export function SortableHeader<K extends string>({
  sortKey,
  state,
  numeric,
  children,
}: SortableHeaderProps<K>) {
  const keys = state.keys ?? { sort: "tri", dir: "sens" };
  const active = state.sort === sortKey;
  const nextDir = active ? (state.dir === "asc" ? "desc" : "asc") : state.defaultDir[sortKey];
  const params = new URLSearchParams(state.params);
  params.set(keys.sort, sortKey);
  params.set(keys.dir, nextDir);
  params.delete("page");
  const Icon = active ? (state.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <Link
      href={`${state.pathname}?${params.toString()}`}
      className={cn(
        "hover:text-ink inline-flex items-center gap-1 rounded-xs",
        numeric && "flex-row-reverse",
        active && "text-ink",
      )}
      aria-label={`Trier par ${typeof children === "string" ? children.toLowerCase() : sortKey}${active ? (state.dir === "asc" ? " (croissant)" : " (décroissant)") : ""}`}
    >
      {children}
      <Icon className={cn("size-3", !active && "text-ink-faint")} aria-hidden />
    </Link>
  );
}
