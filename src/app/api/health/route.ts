import { NextResponse } from "next/server";

/**
 * Liveness only: the process is up and can answer HTTP. No version, environment, or
 * dependency detail — that's for internal logs/metrics, not a public endpoint. See
 * /api/ready for a check that also confirms the database is reachable.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
