import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Dedicated database so end-to-end runs never touch the local workspace. */
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://matiere:matiere@localhost:55432/matiere_e2e";
const E2E_AUTH_SECRET = "e2e-test-secret-not-for-any-real-environment-32";
export const E2E_USER = { email: "e2e@matiere.test", password: "e2e-test-password-123" };

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
    // Migrate + seed the e2e database and provision the one e2e user, then serve it.
    // Next.js allows a single `next dev` per project directory: stop any other dev server
    // before running the suite.
    command:
      `npx tsx src/db/seed-cli.ts && ` +
      `npx tsx src/db/create-user-cli.ts --email=${E2E_USER.email} --password=${E2E_USER.password} --name="E2E" --role=OWNER && ` +
      `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      NODE_ENV: "development",
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /auth\.spec\.ts/],
    },
    {
      // Runs signed out, on purpose: login/redirect/cross-tenant-denial checks must not
      // reuse the authenticated storage state above.
      name: "chromium-unauthenticated",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testMatch: /auth\.spec\.ts/,
    },
  ],
});
