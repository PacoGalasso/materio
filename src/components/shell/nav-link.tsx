"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface NavLinkProps {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  /** Match nested routes too (default true). Set false for the root "/" entry. */
  nested?: boolean;
  trailing?: ReactNode;
  onNavigate?: () => void;
}

export function NavLink({
  href,
  icon,
  children,
  nested = true,
  trailing,
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = nested ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "text-rail-text flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-sm font-medium transition-colors duration-75",
        "hover:bg-rail-hover hover:text-ink-inverse focus-visible:outline-ink-inverse",
        active && "bg-rail-active text-ink-inverse",
      )}
    >
      <span
        className={cn("text-rail-text-muted shrink-0", active && "text-ink-inverse")}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}
