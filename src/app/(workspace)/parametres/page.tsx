import { OrganizationForm, ResetDemoDialog, YardForm } from "@/components/settings/settings-forms";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { DataRow } from "@/components/ui/stat";
import { getWorkspace } from "@/server/context";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const { organization, yard } = await getWorkspace();

  return (
    <>
      <PageHeader title="Paramètres" context="Entreprise, site et espace de démonstration" />
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <section className="panel p-5">
            <SectionTitle className="mb-4">Entreprise</SectionTitle>
            <OrganizationForm organization={organization} />
          </section>
          <section className="panel p-5">
            <SectionTitle className="mb-4">Site d&apos;exploitation</SectionTitle>
            <YardForm yard={yard} />
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="panel px-4 py-3">
            <SectionTitle className="mb-1">Conventions</SectionTitle>
            <dl className="divide-line-soft divide-y">
              <DataRow label="Monnaie">{organization.currency}</DataRow>
              <DataRow label="Unité de poids">
                {organization.weightUnit} (stockage au gramme)
              </DataRow>
              <DataRow label="Prix unitaires">centimes par tonne (stockage)</DataRow>
              <DataRow label="Langue">Français (Suisse)</DataRow>
              <DataRow label="Fuseau horaire">{organization.timezone}</DataRow>
              <DataRow label="Formats">CHF 9&apos;532.50 · 1&apos;550 kg · 01.09.2026</DataRow>
            </dl>
            <p className="text-ink-muted mt-3 text-xs">
              Ces conventions sont fixées pour la version locale. Elles deviendront configurables
              par organisation lors de l&apos;introduction des comptes.
            </p>
          </section>

          <section className="panel px-4 py-3">
            <SectionTitle className="mb-1">Données de démonstration</SectionTitle>
            <p className="text-ink-muted mb-3 text-xs">
              Cet espace contient des données fictives (RecycLéman SA). La réinitialisation régénère
              un jeu complet et cohérent daté d&apos;aujourd&apos;hui.
            </p>
            <ResetDemoDialog />
          </section>
        </div>
      </div>
    </>
  );
}
