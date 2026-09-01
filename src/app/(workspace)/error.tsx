"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const notInitialized = error.message.includes("No organization found");

  return (
    <div className="flex flex-1 items-start justify-center p-5">
      <div className="panel w-full max-w-lg p-5">
        <h1 className="mb-3 text-lg">Une erreur est survenue</h1>
        <Notice tone="danger">
          {notInitialized
            ? "L'espace de travail n'est pas initialisé. Exécutez « npm run db:setup » puis rechargez la page."
            : "L'opération n'a pas pu être effectuée. Réessayez ; si le problème persiste, vérifiez la base de données locale."}
        </Notice>
        {error.digest ? (
          <p className="text-ink-faint mt-2 font-mono text-2xs">Référence : {error.digest}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => reset()}>
            Réessayer
          </Button>
          <ButtonLink href="/">Tableau de bord</ButtonLink>
        </div>
      </div>
    </div>
  );
}
