/**
 * Workspace context.
 *
 * V1 runs a single local demo workspace: the seeded organization and its default yard.
 * Real authentication and organization tenancy plug in here later: resolve the caller's
 * organization from a session instead of taking the first row, and every use case already
 * receives an explicit `organizationId`.
 */
import { asc, eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/db/client";
import { organizations, yards, type Organization, type Yard } from "@/db/schema";

export interface Workspace {
  organization: Organization;
  yard: Yard;
}

export class WorkspaceNotInitializedError extends Error {
  constructor() {
    super("No organization found. Run `npm run db:setup` to create the demo workspace.");
    this.name = "WorkspaceNotInitializedError";
  }
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const db = await getDb();
  const organization = (await db.select().from(organizations).limit(1)).at(0);
  if (!organization) return null;
  const yard =
    (
      await db
        .select()
        .from(yards)
        .where(eq(yards.organizationId, organization.id))
        .orderBy(asc(yards.isDefault), asc(yards.createdAt))
        .limit(1)
    ).at(0) ?? null;
  if (!yard) return null;
  return { organization, yard };
}

/** Request-scoped workspace (React `cache` dedupes calls within one render). */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const workspace = await loadWorkspace();
  if (!workspace) throw new WorkspaceNotInitializedError();
  return workspace;
});
