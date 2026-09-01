import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SupplierEditDialog } from "@/components/suppliers/supplier-edit-dialog";
import { VehicleManager } from "@/components/suppliers/vehicle-manager";
import { TicketTable } from "@/components/tickets/ticket-table";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { DataRow, Stat } from "@/components/ui/stat";
import { Tag } from "@/components/ui/status-badge";
import { countLabel, formatChf, formatRelativeDateTime, formatWeight } from "@/lib/format";
import { getWorkspace } from "@/server/context";
import { getSupplier, listSupplierVehicles, listSuppliers } from "@/server/queries/suppliers";
import { listTickets } from "@/server/queries/tickets";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const { organization } = await getWorkspace();
  const supplier = await getSupplier(organization.id, id);
  return { title: supplier?.name ?? "Fournisseur" };
}

export default async function SupplierPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { organization } = await getWorkspace();
  const supplier = await getSupplier(organization.id, id);
  if (!supplier) notFound();

  const pageRaw = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const now = new Date();
  const [vehicles, tickets, stats] = await Promise.all([
    listSupplierVehicles(supplier.id),
    listTickets(organization.id, { supplierId: supplier.id, page, pageSize: 15 }),
    listSuppliers(organization.id, { includeInactive: true }).then((rows) =>
      rows.find((row) => row.id === supplier.id),
    ),
  ]);
  const address = [
    supplier.street,
    `${supplier.postalCode} ${supplier.city}`.trim(),
    supplier.canton,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        leading={
          <Link
            href="/fournisseurs"
            className="text-ink-muted hover:text-ink flex size-7 items-center justify-center rounded-sm"
            aria-label="Retour aux fournisseurs"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            {supplier.name}
            {!supplier.isActive ? <Tag>Inactif</Tag> : null}
          </span>
        }
        context={address || "Adresse non renseignée"}
        actions={
          <>
            <SupplierEditDialog supplier={supplier} />
            <ButtonLink
              href={`/pesees/nouvelle?fournisseur=${supplier.id}`}
              variant="primary"
              icon={<Plus className="size-4" aria-hidden />}
            >
              Nouvelle pesée
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-col gap-5 p-5">
        <section
          aria-label="Activité du fournisseur"
          className="panel divide-line-soft grid grid-cols-2 md:grid-cols-4 md:divide-x"
        >
          <Stat
            label="Pesées"
            value={String(stats?.ticketCount ?? 0)}
            detail={`${stats?.completedCount ?? 0} terminées`}
          />
          <Stat
            label="Matière reçue"
            value={formatWeight(stats?.totalReceivedG ?? 0)}
            detail="pesées terminées"
          />
          <Stat
            label="Achats cumulés"
            value={formatChf(stats?.totalPurchasedCts ?? 0)}
            detail="toutes périodes"
          />
          <Stat
            label="Dernière livraison"
            value={
              stats?.lastDeliveryAt
                ? (formatRelativeDateTime(stats.lastDeliveryAt, now).split(" · ")[0] ?? "—")
                : "—"
            }
            detail={
              stats?.lastDeliveryAt
                ? formatRelativeDateTime(stats.lastDeliveryAt, now)
                : "aucune pesée"
            }
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="panel">
            <div className="border-line-soft border-b px-4 py-3">
              <SectionTitle trailing={countLabel(tickets.total, "pesée")}>
                Historique des pesées
              </SectionTitle>
            </div>
            {tickets.rows.length > 0 ? (
              <TicketTable rows={tickets.rows} compact hideSupplier />
            ) : (
              <EmptyState compact title="Aucune pesée pour ce fournisseur" />
            )}
            {tickets.total > 0 ? (
              <div className="border-line-soft border-t px-4 py-2.5">
                <Pagination
                  page={tickets.page}
                  pageCount={tickets.pageCount}
                  total={tickets.total}
                  pathname={`/fournisseurs/${supplier.id}`}
                  params={new URLSearchParams()}
                  singular="pesée"
                />
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-5">
            <section className="panel px-4 py-3">
              <SectionTitle className="mb-1">Coordonnées</SectionTitle>
              <dl className="divide-line-soft divide-y">
                <DataRow label="Contact">
                  {supplier.contactName || <span className="text-ink-faint">—</span>}
                </DataRow>
                <DataRow label="Téléphone" numeric>
                  {supplier.phone ? (
                    <a href={`tel:${supplier.phone}`} className="hover:underline">
                      {supplier.phone}
                    </a>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </DataRow>
                <DataRow label="E-mail">
                  {supplier.email ? (
                    <a href={`mailto:${supplier.email}`} className="truncate hover:underline">
                      {supplier.email}
                    </a>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </DataRow>
                <DataRow label="N° IDE / TVA">
                  {supplier.vatNumber ? (
                    <span className="font-mono text-xs">{supplier.vatNumber}</span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </DataRow>
              </dl>
              {supplier.notes ? (
                <p className="text-ink-secondary border-line-soft mt-2 border-t pt-2 text-xs whitespace-pre-line">
                  {supplier.notes}
                </p>
              ) : null}
            </section>

            <section className="panel px-4 py-3">
              <SectionTitle className="mb-2" trailing={countLabel(vehicles.length, "véhicule")}>
                Véhicules
              </SectionTitle>
              <VehicleManager supplierId={supplier.id} vehicles={vehicles} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
