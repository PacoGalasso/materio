import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SupplierForm } from "@/components/suppliers/supplier-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Nouveau fournisseur" };

export default function NewSupplierPage() {
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
        title="Nouveau fournisseur"
        context="Coordonnées et informations de facturation"
      />
      <div className="p-5">
        <div className="panel max-w-3xl p-5">
          <SupplierForm />
        </div>
      </div>
    </>
  );
}
