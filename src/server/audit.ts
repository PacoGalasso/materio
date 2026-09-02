/**
 * Append-only audit trail. Always called inside the same transaction as the business write
 * it records (see src/server/use-cases/*) so the two can never diverge — a rolled-back
 * mutation never leaves an orphaned audit row, and a committed mutation is never silently
 * unaudited.
 */
import { randomUUID } from "node:crypto";

import type { DatabaseExecutor } from "@/db/client";
import { auditEvents, type AuditAction } from "@/db/schema";

export interface AuditEventInput {
  organizationId: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Safe, non-sensitive context only — never passwords, tokens, cookies or headers. */
  metadata?: Record<string, unknown>;
}

export async function writeAuditEvent(tx: DatabaseExecutor, input: AuditEventInput): Promise<void> {
  await tx.insert(auditEvents).values({
    id: randomUUID(),
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}
