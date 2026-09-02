import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { NewWeighingForm } from "@/components/weighing/new-weighing-form";
import { PageHeader } from "@/components/ui/page-header";
import { toDateInputValue, toTimeInputValue } from "@/lib/format";
import { getOrgContext } from "@/server/context";
import { listMaterials } from "@/server/queries/materials";
import { listSupplierOptions } from "@/server/queries/suppliers";

export const metadata = { title: "Nouvelle pesée" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewWeighingPage({ searchParams }: PageProps) {
  const { organization, yard } = await getOrgContext();
  const query = await searchParams;
  const initialSupplierId =
    (Array.isArray(query.fournisseur) ? query.fournisseur[0] : query.fournisseur) ?? null;
  const [suppliers, materials] = await Promise.all([
    listSupplierOptions(organization.id),
    listMaterials(organization.id),
  ]);
  const now = new Date();

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
        title="Nouvelle pesée"
        context={`${yard.name} · réception de matière`}
      />
      <div className="p-5">
        <NewWeighingForm
          suppliers={suppliers}
          materials={materials.map((m) => ({
            id: m.id,
            name: m.name,
            code: m.code,
            category: m.category,
            priceUnit: m.priceUnit,
            currentPurchasePriceCtsPerT: m.currentPurchasePriceCtsPerT,
          }))}
          defaultDate={toDateInputValue(now)}
          defaultTime={toTimeInputValue(now)}
          initialSupplierId={initialSupplierId}
        />
      </div>
    </>
  );
}
