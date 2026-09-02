import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";

/**
 * Readiness: confirms the database is actually reachable, for orchestrators that gate
 * traffic on it (e.g. don't route to an instance until this returns 200). No DB host,
 * credential, or error detail is ever returned — a failure is just `{ status: "error" }`
 * with a 503; the real diagnostic goes to server logs only.
 */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
