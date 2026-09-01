import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { WEIGHING_STATUSES } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";

import type { TicketPageQuery } from "./ticket-query";

interface TicketFiltersProps {
  query: TicketPageQuery;
  materials: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  hasFilters: boolean;
}

/** GET form: every filter is a URL parameter, so views are shareable and work without JS. */
export function TicketFilters({ query, materials, suppliers, hasFilters }: TicketFiltersProps) {
  return (
    <Form
      action="/pesees"
      className="flex flex-wrap items-end gap-2"
      role="search"
      aria-label="Filtrer les pesées"
    >
      {query.sort !== "date" ? <input type="hidden" name="tri" value={query.sort} /> : null}
      {query.dir !== "desc" ? <input type="hidden" name="sens" value={query.dir} /> : null}
      <div className="relative w-full sm:w-64">
        <label htmlFor="filter-q" className="sr-only">
          Rechercher
        </label>
        <Search
          className="text-ink-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="filter-q"
          name="q"
          defaultValue={query.q}
          placeholder="Référence, fournisseur, plaque…"
          className="pl-8"
        />
      </div>
      <div>
        <label htmlFor="filter-status" className="sr-only">
          Statut
        </label>
        <Select id="filter-status" name="statut" defaultValue={query.status} className="w-36">
          <option value="all">Tous les statuts</option>
          {WEIGHING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="filter-material" className="sr-only">
          Matière
        </label>
        <Select
          id="filter-material"
          name="matiere"
          defaultValue={query.materialId ?? ""}
          className="w-44"
        >
          <option value="">Toutes les matières</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="filter-supplier" className="sr-only">
          Fournisseur
        </label>
        <Select
          id="filter-supplier"
          name="fournisseur"
          defaultValue={query.supplierId ?? ""}
          className="w-52"
        >
          <option value="">Tous les fournisseurs</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <label htmlFor="filter-from" className="text-ink-muted text-xs">
          Du
        </label>
        <Input
          id="filter-from"
          name="du"
          type="date"
          defaultValue={query.from ?? ""}
          className="tnum w-36"
        />
        <label htmlFor="filter-to" className="text-ink-muted text-xs">
          au
        </label>
        <Input
          id="filter-to"
          name="au"
          type="date"
          defaultValue={query.to ?? ""}
          className="tnum w-36"
        />
      </div>
      <Button type="submit" variant="secondary">
        Filtrer
      </Button>
      {hasFilters ? (
        <Link href="/pesees" className={buttonClasses({ variant: "ghost" })}>
          Réinitialiser
        </Link>
      ) : null}
    </Form>
  );
}
