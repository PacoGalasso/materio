import { Plus } from "lucide-react";
import Link from "next/link";

import { ActivityChart } from "@/components/dashboard/activity-chart";
import { OpenTicketsList } from "@/components/dashboard/open-tickets";
import { StockValueChart } from "@/components/dashboard/stock-value-chart";
import { TicketTable } from "@/components/tickets/ticket-table";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { countLabel, formatChf, formatDate, formatWeight } from "@/lib/format";
import { getWorkspace } from "@/server/context";
import { getDashboard } from "@/server/queries/dashboard";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const { organization, yard } = await getWorkspace();
  const data = await getDashboard(organization.id, new Date());
  const { today, now } = data;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        context={`${yard.name} · ${formatDate(now)}`}
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

      <div className="flex flex-col gap-5 p-5">
        <section
          aria-label="Chiffres du jour"
          className="panel grid grid-cols-2 divide-line-soft md:grid-cols-3 md:divide-x xl:grid-cols-5"
        >
          <Stat
            label="Reçu aujourd'hui"
            value={formatWeight(today.receivedG)}
            detail={countLabel(today.receipts, "réception")}
          />
          <Stat
            label="Achats du jour"
            value={formatChf(today.purchasedCts)}
            detail="pesées terminées"
          />
          <Stat
            label="Expédié aujourd'hui"
            value={formatWeight(today.dispatchedG)}
            detail={countLabel(today.dispatches, "expédition")}
          />
          <Stat
            label="Valeur du stock"
            value={formatChf(data.stock.totalValueCts)}
            detail={`${formatWeight(data.stock.totalQuantityG)} au prix de référence`}
          />
          <Stat
            label="Pesées en attente"
            value={String(data.openTickets.length)}
            detail={`${countLabel(today.weighings, "pesée")} aujourd'hui`}
            tone={data.openTickets.length > 0 ? "warning" : "default"}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
          <section className="panel flex flex-col">
            <div className="border-line-soft border-b px-4 py-3">
              <SectionTitle
                trailing={
                  <Link href="/pesees?statut=open" className="hover:text-ink hover:underline">
                    Voir toutes les pesées en attente
                  </Link>
                }
              >
                Pesées à finaliser
              </SectionTitle>
            </div>
            <OpenTicketsList tickets={data.openTickets.slice(0, 6)} now={now} />
          </section>

          <section className="panel flex flex-col">
            <div className="border-line-soft border-b px-4 py-3">
              <SectionTitle
                trailing={
                  <Link href="/stock" className="hover:text-ink hover:underline">
                    Stock complet
                  </Link>
                }
              >
                Valeur immobilisée par matière
              </SectionTitle>
            </div>
            <div className="p-4">
              <StockValueChart lines={data.stock.lines} totalValueCts={data.stock.totalValueCts} />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="border-line-soft border-b px-4 py-3">
            <SectionTitle>Activité du site</SectionTitle>
          </div>
          <div className="p-4">
            <ActivityChart activity={data.activity} now={now} />
          </div>
        </section>

        <section className="panel">
          <div className="border-line-soft border-b px-4 py-3">
            <SectionTitle
              trailing={
                <Link href="/pesees" className="hover:text-ink hover:underline">
                  Historique complet
                </Link>
              }
            >
              Dernières pesées terminées
            </SectionTitle>
          </div>
          {data.recentTickets.length > 0 ? (
            <TicketTable rows={data.recentTickets} compact />
          ) : (
            <EmptyState
              compact
              title="Aucune pesée terminée"
              description="Les pesées terminées apparaîtront ici."
            />
          )}
        </section>
      </div>
    </>
  );
}
