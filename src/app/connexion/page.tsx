import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ suivant?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { suivant } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="panel w-full max-w-sm p-5">
        <h1 className="mb-1 text-lg">MATIÈRE</h1>
        <p className="text-ink-muted mb-4 text-sm">Connectez-vous à votre espace de travail.</p>
        <SignInForm next={suivant && suivant.startsWith("/") ? suivant : "/"} />
      </div>
    </div>
  );
}
