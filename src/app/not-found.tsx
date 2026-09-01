import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="panel w-full max-w-md p-6 text-center">
        <p className="label-caps">Erreur 404</p>
        <h1 className="mt-1 text-lg">Page introuvable</h1>
        <p className="text-ink-muted mt-2 text-sm">
          L&apos;élément demandé n&apos;existe pas ou a été supprimé.
        </p>
        <Link href="/" className={buttonClasses({ variant: "primary", className: "mt-4" })}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
