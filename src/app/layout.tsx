import type { Metadata } from "next";

import { plexMono, plexSans } from "./fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MATIÈRE",
    template: "%s · MATIÈRE",
  },
  description: "Operations intelligence for material recovery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CH" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
