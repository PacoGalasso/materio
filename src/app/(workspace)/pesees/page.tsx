import { Plus, Scale } from "lucide-react";

import { TicketFilters } from "@/components/tickets/ticket-filters";
import {
  hasActiveFilters,
  parseTicketQuery,
  toListFilters,
  toSearchParams,
  type SearchParams,
} from "@/components/tickets/ticket-query";
import { TICKET_SORT_DEFAULT_DIR, TicketTable } from "@/components/tickets/ticket-table";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { countLabel } from "@/lib/format";
import { getOrgContext } from "@/server/context";
import { listMaterials } from "@/server/queries/materials";
import { listSuppliers } from "@/server/queries/suppliers";
import { listTickets } from "@/server/queries/tickets";

export const metadata = { title: "Pesées" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { organization } = await getOrgContext();
  const query = parseTicketQuery(await searchParams);
  const [result, materials, suppliers] = await Promise.all([
    listTickets(organization.id, toListFilters(query)),
    listMaterials(organization.id, { includeInactive: true }),
    listSuppliers(organization.id, { includeInactive: true }),
  ]);
  const filtersActive = hasActiveFilters(query);
  const params = toSearchParams(query);

  return (
    <>
      <PageHeader
        title="Pesées"
        context={`${countLabel(result.total, "pesée")}${filtersActive ? " correspondant aux filtres" : " enregistrées"}`}
        actions={
          <ButtonLink
            href="/pesees/nouvelle"
            variant="primary"
            icon={<Plus className="size-4" aria-hidden />}
          >
            Nouvelle pesée
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <TicketFilters
          query={query}
          materials={materials.map((m) => ({ id: m.id, name: m.name }))}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          hasFilters={filtersActive}
        />
        <section className="panel">
          {result.rows.length > 0 ? (
            <TicketTable
              rows={result.rows}
              sort={{
                sort: query.sort,
                dir: query.dir,
                params,
                pathname: "/pesees",
                defaultDir: TICKET_SORT_DEFAULT_DIR,
              }}
            />
          ) : (
            <EmptyState
              icon={<Scale className="size-6" />}
              title={
                filtersActive
                  ? "Aucune pesée ne correspond aux filtres"
                  : "Aucune pesée enregistrée"
              }
              description={
                filtersActive
                  ? "Élargissez la période ou réinitialisez les filtres."
                  : "Créez la première pesée pour démarrer le suivi des réceptions."
              }
              action={
                filtersActive ? (
                  <ButtonLink href="/pesees">Réinitialiser les filtres</ButtonLink>
                ) : (
                  <ButtonLink href="/pesees/nouvelle" variant="primary">
                    Nouvelle pesée
                  </ButtonLink>
                )
              }
            />
          )}
          {result.total > 0 ? (
            <div className="border-line-soft border-t px-4 py-2.5">
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                total={result.total}
                pathname="/pesees"
                params={params}
                singular="pesée"
              />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
