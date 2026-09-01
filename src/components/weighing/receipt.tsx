import Link from "next/link";

import { MaterialName } from "@/components/ui/category-swatch";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Organization } from "@/db/schema";
import { formatChf, formatDateTime, formatKg, formatUnitPrice } from "@/lib/format";
import { STATUS_DESCRIPTIONS } from "@/lib/labels";
import type { TicketDetail } from "@/server/queries/tickets";

interface ReceiptProps {
  detail: TicketDetail;
  organization: Organization;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps mb-1">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** The printable "Bulletin de pesée": an industrial transaction record, not a dashboard card. */
export function Receipt({ detail, organization }: ReceiptProps) {
  const { ticket, supplier, material, yard, movement } = detail;
  const addressLine = [
    organization.street,
    `${organization.postalCode} ${organization.city}`.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const supplierAddress = [supplier.street, `${supplier.postalCode} ${supplier.city}`.trim()]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="panel print:border-0" aria-labelledby="receipt-title">
      <header className="border-line flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <p className="text-base font-semibold">{organization.legalName}</p>
          <p className="text-ink-muted text-xs">{addressLine}</p>
          <p className="text-ink-muted text-xs">
            {[organization.vatNumber, organization.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="label-caps">Bulletin de pesée</p>
          <h2 id="receipt-title" className="tnum font-mono text-2xl font-medium">
            {ticket.reference}
          </h2>
          <div className="mt-1 flex justify-end">
            <StatusBadge status={ticket.status} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
        <Block title="Fournisseur">
          <p className="font-medium">
            <Link
              href={`/fournisseurs/${supplier.id}`}
              className="hover:underline print:no-underline"
            >
              {supplier.name}
            </Link>
          </p>
          {supplierAddress ? <p className="text-ink-secondary">{supplierAddress}</p> : null}
          {supplier.contactName ? (
            <p className="text-ink-secondary">{supplier.contactName}</p>
          ) : null}
          {supplier.vatNumber ? (
            <p className="text-ink-muted text-xs">{supplier.vatNumber}</p>
          ) : null}
        </Block>
        <Block title="Véhicule et site">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            <dt className="text-ink-muted">Immatriculation</dt>
            <dd className="font-mono font-medium">{ticket.plateSnapshot}</dd>
            <dt className="text-ink-muted">Site</dt>
            <dd>{yard.name}</dd>
            {ticket.externalReference ? (
              <>
                <dt className="text-ink-muted">Réf. externe</dt>
                <dd className="font-mono">{ticket.externalReference}</dd>
              </>
            ) : null}
          </dl>
        </Block>
      </div>

      <div className="px-6 pb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps border-line border-b">
              <th scope="col" className="py-1.5 text-left font-medium">
                Pesée
              </th>
              <th scope="col" className="py-1.5 text-left font-medium">
                Horodatage
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Poids
              </th>
            </tr>
          </thead>
          <tbody className="divide-line-soft divide-y">
            <tr>
              <td className="py-2">Poids brut (entrée)</td>
              <td className="tnum text-ink-secondary py-2">
                {formatDateTime(ticket.grossWeighedAt)}
              </td>
              <td className="tnum py-2 text-right font-medium">{formatKg(ticket.grossWeightG)}</td>
            </tr>
            <tr>
              <td className="py-2">Tare (sortie)</td>
              <td className="tnum text-ink-secondary py-2">
                {ticket.tareWeighedAt ? (
                  formatDateTime(ticket.tareWeighedAt)
                ) : (
                  <span className="text-ink-faint">en attente</span>
                )}
              </td>
              <td className="tnum py-2 text-right font-medium">
                {ticket.tareWeightG === null ? (
                  <span className="text-ink-faint">—</span>
                ) : (
                  formatKg(ticket.tareWeightG)
                )}
              </td>
            </tr>
            <tr className="border-line border-t-2">
              <td className="py-2.5 font-semibold">Poids net</td>
              <td />
              <td className="tnum py-2.5 text-right text-xl font-semibold">
                {ticket.netWeightG === null ? (
                  <span className="text-ink-faint text-base font-normal">—</span>
                ) : (
                  formatKg(ticket.netWeightG)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-line-soft grid gap-6 border-t px-6 py-5 md:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Block title="Matière">
            <Link href={`/matieres/${material.id}`} className="hover:underline print:no-underline">
              <MaterialName name={material.name} category={material.category} />
            </Link>
            <p className="text-ink-muted text-xs">{material.code}</p>
          </Block>
          <Block title="Prix d'achat">
            <p className="tnum font-medium">
              {formatUnitPrice(ticket.unitPriceCtsPerT, material.priceUnit)}
            </p>
            {ticket.unitPriceCtsPerT !== material.currentPurchasePriceCtsPerT ? (
              <p className="text-ink-muted text-xs">
                Prix de référence actuel :{" "}
                {formatUnitPrice(material.currentPurchasePriceCtsPerT, material.priceUnit)}
              </p>
            ) : null}
          </Block>
        </div>
        <div className="md:text-right">
          <p className="label-caps">Valeur de la transaction</p>
          <p className="tnum text-3xl font-semibold">
            {ticket.totalAmountCts === null ? (
              <span className="text-ink-faint text-lg font-normal">à déterminer</span>
            ) : (
              formatChf(ticket.totalAmountCts)
            )}
          </p>
          <p className="text-ink-muted text-xs">
            {ticket.netWeightG === null
              ? "Net × prix d'achat, calculé à la sortie"
              : "Net × prix d'achat, TVA non incluse"}
          </p>
        </div>
      </div>

      {ticket.notes ? (
        <div className="border-line-soft border-t px-6 py-4">
          <Block title="Notes">
            <p className="whitespace-pre-line">{ticket.notes}</p>
          </Block>
        </div>
      ) : null}

      <footer className="border-line-soft bg-surface-muted flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-xs print:bg-transparent">
        <p className="text-ink-secondary">
          {movement
            ? `Réception comptabilisée en stock le ${formatDateTime(movement.occurredAt)} · +${formatKg(movement.quantityG)} ${material.name}`
            : STATUS_DESCRIPTIONS[ticket.status]}
        </p>
        <p className="text-ink-faint">Généré par MATIÈRE · données de démonstration</p>
      </footer>
    </article>
  );
}
