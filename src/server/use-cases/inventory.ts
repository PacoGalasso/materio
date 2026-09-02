import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction, type Database } from "@/db/client";
import { inventoryMovements, materials } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { adjustmentMovement, dispatchMovement } from "@/domain/inventory";
import { isValidId } from "@/lib/id";
import { writeAuditEvent } from "@/server/audit";

export interface DispatchInput {
  materialId: string;
  quantityG: number;
  unitValueCtsPerT: number;
  occurredAt: Date;
  note: string;
}

/** Books material leaving the yard (sale/shipment). Refuses to go below the stock on hand. */
export async function recordDispatch(
  db: Database,
  organizationId: string,
  yardId: string,
  actorUserId: string,
  input: DispatchInput,
): Promise<{ id: string }> {
  if (!isValidId(input.materialId)) throw new DomainError("MATERIAL_NOT_FOUND");
  return withTransaction(db, async (tx) => {
    // Locks the material row so two concurrent stock-affecting operations on it serialize
    // instead of both reading the same stale sum (see src/db/client.ts withTransaction).
    const [material] = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.organizationId, organizationId), eq(materials.id, input.materialId)))
      .for("update")
      .limit(1);
    if (!material) throw new DomainError("MATERIAL_NOT_FOUND");
    const [stock] = await tx
      .select({ quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)` })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.materialId, input.materialId),
        ),
      );
    const figures = dispatchMovement({
      quantityG: input.quantityG,
      unitValueCtsPerT: input.unitValueCtsPerT,
      currentStockG: stock?.quantityG ?? 0,
    });
    const id = randomUUID();
    await tx.insert(inventoryMovements).values({
      id,
      organizationId,
      yardId,
      materialId: input.materialId,
      weighingTicketId: null,
      ...figures,
      occurredAt: input.occurredAt,
      note: input.note,
    });
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "INVENTORY_DISPATCHED",
      entityType: "inventory_movement",
      entityId: id,
      metadata: { materialId: input.materialId, quantityG: input.quantityG },
    });
    return { id };
  });
}

export interface AdjustmentInput {
  materialId: string;
  /** Signed grams: positive adds, negative removes. */
  quantityG: number;
  unitValueCtsPerT: number;
  occurredAt: Date;
  note: string;
}

/** Manual stock correction (inventory count). Cannot take the stock negative. */
export async function recordAdjustment(
  db: Database,
  organizationId: string,
  yardId: string,
  actorUserId: string,
  input: AdjustmentInput,
): Promise<{ id: string }> {
  if (!isValidId(input.materialId)) throw new DomainError("MATERIAL_NOT_FOUND");
  return withTransaction(db, async (tx) => {
    const [material] = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.organizationId, organizationId), eq(materials.id, input.materialId)))
      .for("update")
      .limit(1);
    if (!material) throw new DomainError("MATERIAL_NOT_FOUND");
    const [stock] = await tx
      .select({ quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)` })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.materialId, input.materialId),
        ),
      );
    if ((stock?.quantityG ?? 0) + input.quantityG < 0) {
      throw new DomainError("STOCK_INSUFFICIENT", { field: "quantity" });
    }
    const figures = adjustmentMovement({
      quantityG: input.quantityG,
      unitValueCtsPerT: input.unitValueCtsPerT,
    });
    const id = randomUUID();
    await tx.insert(inventoryMovements).values({
      id,
      organizationId,
      yardId,
      materialId: input.materialId,
      weighingTicketId: null,
      ...figures,
      occurredAt: input.occurredAt,
      note: input.note,
    });
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "INVENTORY_ADJUSTED",
      entityType: "inventory_movement",
      entityId: id,
      metadata: { materialId: input.materialId, quantityG: input.quantityG },
    });
    return { id };
  });
}
