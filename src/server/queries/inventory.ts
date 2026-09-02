import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  inventoryMovements,
  materials,
  suppliers,
  weighingTickets,
  type MaterialCategory,
  type MovementType,
  type PriceUnit,
} from "@/db/schema";
import { stockValueCts } from "@/domain/inventory";
import { isValidId } from "@/lib/id";

export interface StockLine {
  materialId: string;
  code: string;
  name: string;
  category: MaterialCategory;
  priceUnit: PriceUnit;
  isActive: boolean;
  quantityG: number;
  referencePriceCtsPerT: number;
  valueCts: number;
  lastMovementAt: Date | null;
  movementCount: number;
  receivedLast7dG: number;
  dispatchedLast7dG: number;
}

export interface StockOverview {
  lines: StockLine[];
  totalQuantityG: number;
  totalValueCts: number;
}

export async function getStockOverview(
  organizationId: string,
  now: Date = new Date(),
): Promise<StockOverview> {
  const db = await getDb();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);

  const rows = await db
    .select({
      materialId: materials.id,
      code: materials.code,
      name: materials.name,
      category: materials.category,
      priceUnit: materials.priceUnit,
      isActive: materials.isActive,
      referencePriceCtsPerT: materials.currentPurchasePriceCtsPerT,
      quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)`,
      lastMovementAt: sql<Date | null>`max(${inventoryMovements.occurredAt})`,
      movementCount: sql<number>`count(${inventoryMovements.id})`,
      receivedLast7dG: sql<number>`coalesce(sum(case when ${inventoryMovements.quantityG} > 0 and ${inventoryMovements.occurredAt} >= ${sevenDaysAgo} then ${inventoryMovements.quantityG} else 0 end), 0)`,
      dispatchedLast7dG: sql<number>`coalesce(sum(case when ${inventoryMovements.quantityG} < 0 and ${inventoryMovements.occurredAt} >= ${sevenDaysAgo} then -${inventoryMovements.quantityG} else 0 end), 0)`,
    })
    .from(materials)
    .leftJoin(inventoryMovements, eq(inventoryMovements.materialId, materials.id))
    .where(eq(materials.organizationId, organizationId))
    .groupBy(materials.id)
    .orderBy(asc(materials.sortOrder), asc(materials.name));

  const lines: StockLine[] = rows.map((row) => ({
    ...row,
    lastMovementAt: row.lastMovementAt === null ? null : new Date(row.lastMovementAt),
    valueCts: stockValueCts(row.quantityG, row.referencePriceCtsPerT),
  }));

  return {
    lines,
    totalQuantityG: lines.reduce((sum, line) => sum + line.quantityG, 0),
    totalValueCts: lines.reduce((sum, line) => sum + line.valueCts, 0),
  };
}

export interface MovementRow {
  id: string;
  type: MovementType;
  quantityG: number;
  unitValueCtsPerT: number;
  amountCts: number;
  occurredAt: Date;
  note: string;
  materialId: string;
  materialName: string;
  materialCategory: MaterialCategory;
  priceUnit: PriceUnit;
  ticketId: string | null;
  ticketReference: string | null;
  supplierName: string | null;
}

export async function listMovements(
  organizationId: string,
  options: { materialId?: string; limit?: number; since?: Date } = {},
): Promise<MovementRow[]> {
  if (options.materialId && !isValidId(options.materialId)) return [];
  const db = await getDb();
  const conditions: SQL[] = [eq(inventoryMovements.organizationId, organizationId)];
  if (options.materialId) conditions.push(eq(inventoryMovements.materialId, options.materialId));
  if (options.since) conditions.push(gte(inventoryMovements.occurredAt, options.since));

  return db
    .select({
      id: inventoryMovements.id,
      type: inventoryMovements.type,
      quantityG: inventoryMovements.quantityG,
      unitValueCtsPerT: inventoryMovements.unitValueCtsPerT,
      amountCts: inventoryMovements.amountCts,
      occurredAt: inventoryMovements.occurredAt,
      note: inventoryMovements.note,
      materialId: inventoryMovements.materialId,
      materialName: materials.name,
      materialCategory: materials.category,
      priceUnit: materials.priceUnit,
      ticketId: weighingTickets.id,
      ticketReference: weighingTickets.reference,
      supplierName: suppliers.name,
    })
    .from(inventoryMovements)
    .innerJoin(materials, eq(materials.id, inventoryMovements.materialId))
    .leftJoin(weighingTickets, eq(weighingTickets.id, inventoryMovements.weighingTicketId))
    .leftJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .where(and(...conditions))
    .orderBy(desc(inventoryMovements.occurredAt), desc(inventoryMovements.createdAt))
    .limit(options.limit ?? 100);
}

/** Current stock of one material in grams (signed sum of its movements). */
export async function getMaterialStockG(
  organizationId: string,
  materialId: string,
): Promise<number> {
  if (!isValidId(materialId)) return 0;
  const db = await getDb();
  const [row] = await db
    .select({ quantityG: sql<number>`coalesce(sum(${inventoryMovements.quantityG}), 0)` })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.materialId, materialId),
      ),
    );
  return row?.quantityG ?? 0;
}
