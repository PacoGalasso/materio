import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  inventoryMovements,
  materialPrices,
  materials,
  type Material,
  type MaterialPrice,
} from "@/db/schema";
import { weightedAveragePriceCtsPerT } from "@/domain/inventory";

export async function listMaterials(
  organizationId: string,
  options: { includeInactive?: boolean } = {},
): Promise<Material[]> {
  const db = await getDb();
  const conditions = [eq(materials.organizationId, organizationId)];
  if (!options.includeInactive) conditions.push(eq(materials.isActive, true));
  return db
    .select()
    .from(materials)
    .where(and(...conditions))
    .orderBy(asc(materials.sortOrder), asc(materials.name));
}

export async function getMaterial(
  organizationId: string,
  materialId: string,
): Promise<Material | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(materials)
    .where(and(eq(materials.organizationId, organizationId), eq(materials.id, materialId)))
    .limit(1);
  return row ?? null;
}

export async function listPriceHistory(materialId: string, limit = 50): Promise<MaterialPrice[]> {
  const db = await getDb();
  return db
    .select()
    .from(materialPrices)
    .where(eq(materialPrices.materialId, materialId))
    .orderBy(desc(materialPrices.effectiveFrom), desc(materialPrices.createdAt))
    .limit(limit);
}

export interface MaterialActivity {
  receivedLast30dG: number;
  receiptsLast30d: number;
  purchasedLast30dCts: number;
  averagePurchasePriceLast30dCtsPerT: number | null;
  dispatchedLast30dG: number;
}

/** 30-day purchase activity of a material, used on its detail page. */
export async function getMaterialActivity(
  materialId: string,
  now: Date = new Date(),
): Promise<MaterialActivity> {
  const db = await getDb();
  const since = new Date(now.getTime() - 30 * 24 * 3_600_000);
  const rows = await db
    .select({
      type: inventoryMovements.type,
      quantityG: inventoryMovements.quantityG,
      amountCts: inventoryMovements.amountCts,
    })
    .from(inventoryMovements)
    .where(
      and(eq(inventoryMovements.materialId, materialId), gte(inventoryMovements.occurredAt, since)),
    );

  const receipts = rows.filter((row) => row.type === "receipt");
  return {
    receivedLast30dG: receipts.reduce((sum, row) => sum + row.quantityG, 0),
    receiptsLast30d: receipts.length,
    purchasedLast30dCts: receipts.reduce((sum, row) => sum + row.amountCts, 0),
    averagePurchasePriceLast30dCtsPerT: weightedAveragePriceCtsPerT(receipts),
    dispatchedLast30dG: rows
      .filter((row) => row.type === "dispatch")
      .reduce((sum, row) => sum - row.quantityG, 0),
  };
}

/** Number of tickets referencing each material (to display usage in the materials list). */
export async function countMaterialUsage(organizationId: string): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({
      materialId: inventoryMovements.materialId,
      count: sql<number>`count(*)`,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.type, "receipt"),
      ),
    )
    .groupBy(inventoryMovements.materialId);
  return new Map(rows.map((row) => [row.materialId, row.count]));
}
