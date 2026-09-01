import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction, type Database } from "@/db/client";
import { inventoryMovements, materials } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { adjustmentMovement, dispatchMovement } from "@/domain/inventory";

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
  input: DispatchInput,
): Promise<{ id: string }> {
  return withTransaction(db, async (tx) => {
    const [material] = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.organizationId, organizationId), eq(materials.id, input.materialId)))
      .limit(1);
    if (!material) throw new DomainError("MATERIAL_NOT_FOUND");
    const [stock] = await tx
      .select({ quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)` })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.materialId, input.materialId));
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
  input: AdjustmentInput,
): Promise<{ id: string }> {
  return withTransaction(db, async (tx) => {
    const [material] = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.organizationId, organizationId), eq(materials.id, input.materialId)))
      .limit(1);
    if (!material) throw new DomainError("MATERIAL_NOT_FOUND");
    const [stock] = await tx
      .select({ quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)` })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.materialId, input.materialId));
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
    return { id };
  });
}
