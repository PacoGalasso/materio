import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The libsql client ships a native binary; it must stay external to the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
  // Keep demos clean: no floating dev badge (the error overlay stays active).
  devIndicators: false,
  // The project maintains its own CLAUDE.md; do not regenerate AGENTS.md on every dev start.
  agentRules: false,
};

export default nextConfig;
