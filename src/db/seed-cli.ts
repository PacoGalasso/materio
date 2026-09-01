import { createDatabase } from "./client";
import { databaseUrl } from "./config";
import { runMigrations } from "./migrate";
import { seedDemoWorkspace } from "./seed";

async function main(): Promise<void> {
  const url = databaseUrl();
  const { db, client } = await createDatabase(url);
  try {
    await runMigrations(db);
    const summary = await seedDemoWorkspace(db);
    console.log(`Demo workspace seeded into ${url}`);
    console.log(
      `  ${summary.materials} matières · ${summary.suppliers} fournisseurs · ${summary.vehicles} véhicules · ` +
        `${summary.tickets} pesées (${summary.openTickets} en attente) · ${summary.movements} mouvements de stock`,
    );
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
