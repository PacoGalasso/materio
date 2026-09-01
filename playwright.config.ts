import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Dedicated database so end-to-end runs never touch the local workspace. */
const E2E_DATABASE_URL = "file:./data/e2e.db";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
  },
  webServer: {
    // Migrate + seed the e2e database, then serve it. Next.js allows a single `next dev`
    // per project directory: stop any other dev server before running the suite.
    command: `npx tsx src/db/seed-cli.ts && npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: E2E_DATABASE_URL },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
