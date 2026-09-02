import { and, eq } from "drizzle-orm";

import { withTransaction, type Database } from "@/db/client";
import { organizations, yards } from "@/db/schema";
import { seedDemoWorkspace, type SeedSummary } from "@/db/seed";
import { writeAuditEvent } from "@/server/audit";

export interface OrganizationInput {
  name: string;
  legalName: string;
  street: string;
  postalCode: string;
  city: string;
  canton: string;
  vatNumber: string;
  phone: string;
  email: string;
  ticketPrefix: string;
}

export async function updateOrganization(
  db: Database,
  organizationId: string,
  actorUserId: string,
  input: OrganizationInput,
): Promise<void> {
  await withTransaction(db, async (tx) => {
    await tx.update(organizations).set(input).where(eq(organizations.id, organizationId));
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      entityType: "organization",
      entityId: organizationId,
      metadata: {},
    });
  });
}

export interface YardInput {
  name: string;
  code: string;
}

export async function updateYard(
  db: Database,
  organizationId: string,
  yardId: string,
  actorUserId: string,
  input: YardInput,
): Promise<void> {
  await withTransaction(db, async (tx) => {
    await tx
      .update(yards)
      .set(input)
      .where(and(eq(yards.organizationId, organizationId), eq(yards.id, yardId)));
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      entityType: "yard",
      entityId: yardId,
      metadata: {},
    });
  });
}

/** Drops every row and rebuilds the demo dataset relative to "now". */
export async function resetDemoWorkspace(db: Database): Promise<SeedSummary> {
  return seedDemoWorkspace(db);
}
