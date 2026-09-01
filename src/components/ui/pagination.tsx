import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { countLabel } from "@/lib/format";

import { buttonClasses } from "./button";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pathname: string;
  params: URLSearchParams;
  singular: string;
  plural?: string;
}

export function Pagination({
  page,
  pageCount,
  total,
  pathname,
  params,
  singular,
  plural,
}: PaginationProps) {
  const href = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const disabledClasses = "pointer-events-none opacity-50";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-xs">
      <p className="text-ink-muted">
        {countLabel(total, singular, plural)}
        {pageCount > 1 ? ` · page ${page} sur ${pageCount}` : ""}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Link
            href={href(page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={cn(buttonClasses({ size: "sm" }), page <= 1 && disabledClasses)}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Précédent
          </Link>
          <Link
            href={href(page + 1)}
            aria-disabled={page >= pageCount}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={cn(buttonClasses({ size: "sm" }), page >= pageCount && disabledClasses)}
          >
            Suivant
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
