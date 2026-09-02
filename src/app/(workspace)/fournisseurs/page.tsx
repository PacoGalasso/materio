import { Building2, Plus, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import type { SearchParams } from "@/components/tickets/ticket-query";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/status-badge";
import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  TableScroller,
  rowLinkClasses,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { countLabel, formatAmount, formatKgValue, formatRelativeDateTime } from "@/lib/format";
import { getOrgContext } from "@/server/context";
import { listSuppliers } from "@/server/queries/suppliers";

export const metadata = { title: "Fournisseurs" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { organization } = await getOrgContext();
  const query = await searchParams;
  const q = (Array.isArray(query.q) ? query.q[0] : query.q)?.trim() ?? "";
  const suppliers = await listSuppliers(organization.id, { q, includeInactive: true });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        context={countLabel(suppliers.length, "fournisseur")}
        actions={
          <ButtonLink
            href="/fournisseurs/nouveau"
            variant="primary"
            icon={<Plus className="size-4" aria-hidden />}
          >
            Nouveau fournisseur
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <Form
          action="/fournisseurs"
          role="search"
          aria-label="Rechercher un fournisseur"
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative w-full sm:w-72">
            <label htmlFor="supplier-search" className="sr-only">
              Rechercher
            </label>
            <Search
              className="text-ink-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="supplier-search"
              name="q"
              defaultValue={q}
              placeholder="Nom, localité, contact…"
              className="pl-8"
            />
          </div>
          <Button type="submit">Rechercher</Button>
          {q ? (
            <Link
              href="/fournisseurs"
              className="text-ink-muted hover:text-ink text-xs hover:underline"
            >
              Effacer
            </Link>
          ) : null}
        </Form>

        <section className="panel">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title={q ? "Aucun fournisseur ne correspond" : "Aucun fournisseur"}
              description={
                q
                  ? "Essayez un autre nom ou une autre localité."
                  : "Créez votre premier fournisseur."
              }
            />
          ) : (
            <TableScroller>
              <Table>
                <THead>
                  <tr>
                    <Th>Fournisseur</Th>
                    <Th>Localité</Th>
                    <Th>Contact</Th>
                    <Th numeric>Pesées</Th>
                    <Th numeric>Reçu (kg)</Th>
                    <Th numeric>Achats (CHF)</Th>
                    <Th>Dernière livraison</Th>
                  </tr>
                </THead>
                <TBody>
                  {suppliers.map((supplier) => (
                    <Tr
                      key={supplier.id}
                      className={cn(
                        rowLinkClasses,
                        "relative",
                        !supplier.isActive && "text-ink-muted",
                      )}
                    >
                      <Td className="font-medium">
                        <Link
                          href={`/fournisseurs/${supplier.id}`}
                          className="after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          {supplier.name}
                        </Link>
                        {!supplier.isActive ? <Tag className="ml-2">Inactif</Tag> : null}
                      </Td>
                      <Td className="text-ink-secondary">
                        {[supplier.postalCode, supplier.city].filter(Boolean).join(" ")}
                        {supplier.canton ? (
                          <span className="text-ink-faint"> · {supplier.canton}</span>
                        ) : null}
                      </Td>
                      <Td className="text-ink-secondary">
                        {supplier.contactName}
                        {supplier.phone ? (
                          <span className="tnum text-ink-faint"> · {supplier.phone}</span>
                        ) : null}
                      </Td>
                      <Td numeric>{supplier.ticketCount}</Td>
                      <Td numeric>{formatKgValue(supplier.totalReceivedG)}</Td>
                      <Td numeric className="font-medium">
                        {formatAmount(supplier.totalPurchasedCts)}
                      </Td>
                      <Td className="tnum text-ink-secondary">
                        {supplier.lastDeliveryAt ? (
                          formatRelativeDateTime(supplier.lastDeliveryAt, now)
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          )}
        </section>
      </div>
    </>
  );
}
