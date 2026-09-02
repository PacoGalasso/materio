import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelWeighingDialog } from "@/components/weighing/cancel-weighing-dialog";
import { CompleteWeighingForm } from "@/components/weighing/complete-weighing-form";
import { PrintButton } from "@/components/weighing/print-button";
import { Receipt } from "@/components/weighing/receipt";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { DataRow } from "@/components/ui/stat";
import {
  formatChf,
  formatDateTime,
  formatKg,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/format";
import { getOrgContext } from "@/server/context";
import { getTicketDetail } from "@/server/queries/tickets";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const { organization } = await getOrgContext();
  const detail = await getTicketDetail(organization.id, id);
  return { title: detail ? `Pesée ${detail.ticket.reference}` : "Pesée" };
}

export default async function TicketPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { organization } = await getOrgContext();
  const detail = await getTicketDetail(organization.id, id);
  if (!detail) notFound();

  const { ticket, material, supplier, movement } = detail;
  const now = new Date();
  const justCreated = query.enregistree === "1";
  const justCompleted = query.terminee === "1";

  return (
    <>
      <PageHeader
        leading={
          <Link
            href="/pesees"
            className="text-ink-muted hover:text-ink flex size-7 items-center justify-center rounded-sm"
            aria-label="Retour aux pesées"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        }
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">{ticket.reference}</span>
          </span>
        }
        context={`${supplier.name} · ${ticket.plateSnapshot} · ${formatDateTime(ticket.grossWeighedAt)}`}
        actions={
          <>
            {ticket.status === "open" ? (
              <CancelWeighingDialog ticketId={ticket.id} reference={ticket.reference} />
            ) : null}
            <PrintButton />
            <ButtonLink
              href="/pesees/nouvelle"
              variant="primary"
              icon={<Plus className="size-4" aria-hidden />}
            >
              Nouvelle pesée
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-col gap-5 p-5 print:p-0">
        {justCreated && ticket.status === "open" ? (
          <Notice tone="success" className="print-hidden">
            Pesée d&apos;entrée enregistrée sous la référence {ticket.reference}. Saisissez la tare
            au départ du véhicule pour la terminer.
          </Notice>
        ) : null}
        {(justCompleted || (justCreated && ticket.status === "completed")) &&
        ticket.status === "completed" ? (
          <Notice tone="success" className="print-hidden">
            Pesée terminée : {ticket.netWeightG !== null ? formatKg(ticket.netWeightG) : ""} de{" "}
            {material.name} ajoutés au stock
            {ticket.totalAmountCts !== null ? ` pour ${formatChf(ticket.totalAmountCts)}` : ""}.
          </Notice>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] print:block">
          <Receipt detail={detail} organization={organization} />

          <aside className="print-hidden flex flex-col gap-4 xl:sticky xl:top-16 xl:self-start">
            {ticket.status === "open" ? (
              <section className="panel p-4">
                <h2 className="mb-1 text-sm font-semibold">Pesée de sortie</h2>
                <p className="text-ink-muted mb-3 text-xs">
                  Le véhicule est pesé à vide au départ. La tare détermine le poids net et la
                  valeur.
                </p>
                <CompleteWeighingForm
                  ticketId={ticket.id}
                  grossWeightG={ticket.grossWeightG}
                  unitPriceCtsPerT={ticket.unitPriceCtsPerT}
                  referencePriceCtsPerT={material.currentPurchasePriceCtsPerT}
                  priceUnit={material.priceUnit}
                  materialName={material.name}
                  notes={ticket.notes}
                  defaultDate={toDateInputValue(now)}
                  defaultTime={toTimeInputValue(now)}
                />
              </section>
            ) : null}

            <section className="panel px-4 py-3">
              <h2 className="mb-1 text-sm font-semibold">Impact sur le stock</h2>
              {movement ? (
                <dl className="divide-line-soft divide-y">
                  <DataRow label="Mouvement">Réception</DataRow>
                  <DataRow label="Quantité" numeric>
                    +{formatKg(movement.quantityG)}
                  </DataRow>
                  <DataRow label="Valorisation" numeric>
                    {formatChf(movement.amountCts)}
                  </DataRow>
                  <DataRow label="Comptabilisé le" numeric>
                    {formatDateTime(movement.occurredAt)}
                  </DataRow>
                  <DataRow label="Matière">
                    <Link href={`/matieres/${material.id}`} className="hover:underline">
                      {material.name}
                    </Link>
                  </DataRow>
                </dl>
              ) : (
                <p className="text-ink-muted text-xs">
                  {ticket.status === "cancelled"
                    ? "Pesée annulée : aucun mouvement de stock."
                    : "Le stock sera mis à jour à la fin de la pesée."}
                </p>
              )}
            </section>

            <section className="panel px-4 py-3">
              <h2 className="mb-1 text-sm font-semibold">Traçabilité</h2>
              <dl className="divide-line-soft divide-y">
                <DataRow label="Créée le" numeric>
                  {formatDateTime(ticket.createdAt)}
                </DataRow>
                {ticket.completedAt ? (
                  <DataRow label="Terminée le" numeric>
                    {formatDateTime(ticket.completedAt)}
                  </DataRow>
                ) : null}
                {ticket.cancelledAt ? (
                  <DataRow label="Annulée le" numeric>
                    {formatDateTime(ticket.cancelledAt)}
                  </DataRow>
                ) : null}
                <DataRow label="Fournisseur">
                  <Link href={`/fournisseurs/${supplier.id}`} className="hover:underline">
                    Fiche fournisseur
                  </Link>
                </DataRow>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
