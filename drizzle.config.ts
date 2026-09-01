import { defineConfig } from "drizzle-kit";

import { serverEnv } from "./src/env/server";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: serverEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
