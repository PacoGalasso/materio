"use client";

import {
  Boxes,
  Building2,
  LayoutDashboard,
  Layers,
  Menu,
  Plus,
  Scale,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";

import { NavLink } from "./nav-link";

interface SidebarProps {
  organizationName: string;
  yardName: string;
}

const NAV = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: <LayoutDashboard className="size-4" />,
    nested: false,
  },
  { href: "/pesees", label: "Pesées", icon: <Scale className="size-4" />, nested: true },
  { href: "/stock", label: "Stock", icon: <Boxes className="size-4" />, nested: true },
  { href: "/matieres", label: "Matières", icon: <Layers className="size-4" />, nested: true },
  {
    href: "/fournisseurs",
    label: "Fournisseurs",
    icon: <Building2 className="size-4" />,
    nested: true,
  },
  { href: "/parametres", label: "Paramètres", icon: <Settings className="size-4" />, nested: true },
] as const;

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2.5 focus-visible:outline-ink-inverse">
      <span
        className="bg-ink-inverse text-rail flex size-6 items-center justify-center rounded-xs font-mono text-xs font-medium"
        aria-hidden
      >
        M
      </span>
      <span className="text-ink-inverse text-sm font-semibold tracking-[0.12em]">MATIÈRE</span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          nested={item.nested}
          onNavigate={onNavigate}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function NewWeighingLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/pesees/nouvelle"
      onClick={onNavigate}
      className="bg-ink-inverse text-rail hover:bg-rail-text flex h-8 items-center justify-between gap-2 rounded-sm px-2.5 text-sm font-medium transition-colors focus-visible:outline-ink-inverse"
    >
      <span className="flex items-center gap-2">
        <Plus className="size-4" aria-hidden />
        Nouvelle pesée
      </span>
      <Kbd className="border-rail-line bg-transparent text-rail" aria-label="Raccourci N">
        N
      </Kbd>
    </Link>
  );
}

function WorkspaceFooter({ organizationName, yardName }: SidebarProps) {
  return (
    <div className="border-rail-line mt-auto border-t px-2.5 pt-3">
      <p className="text-ink-inverse truncate text-xs font-medium">{organizationName}</p>
      <p className="text-rail-text-muted truncate text-2xs">{yardName}</p>
      <p className="text-rail-text-muted mt-2 text-2xs">Espace de démonstration local</p>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Desktop rail */}
      <aside
        aria-label="Barre latérale"
        className="bg-rail print-hidden fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-4 px-2.5 py-4 lg:flex"
      >
        <Brand />
        <NewWeighingLink />
        <NavItems />
        <WorkspaceFooter {...props} />
      </aside>

      {/* Mobile / tablet top bar */}
      <div className="bg-rail print-hidden fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between px-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="text-rail-text hover:bg-rail-hover hover:text-ink-inverse flex size-9 items-center justify-center rounded-sm focus-visible:outline-ink-inverse"
        >
          {open ? <Menu className="size-5 hidden" aria-hidden /> : null}
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      <div
        id="mobile-navigation"
        hidden={!open}
        className={cn(
          "bg-rail print-hidden fixed inset-x-0 top-12 z-30 flex flex-col gap-4 px-2.5 py-4 lg:hidden",
        )}
      >
        <NewWeighingLink onNavigate={close} />
        <NavItems onNavigate={close} />
        <WorkspaceFooter {...props} />
      </div>
    </>
  );
}
