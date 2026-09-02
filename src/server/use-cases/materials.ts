import { randomUUID } from "node:crypto";

import { and, eq, ne, sql } from "drizzle-orm";

import { withTransaction, type Database, type DatabaseExecutor } from "@/db/client";
import {
  materialPrices,
  materials,
  type Material,
  type MaterialCategory,
  type PriceUnit,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { assertUnitPrice } from "@/domain/units";
import { isValidId } from "@/lib/id";
import { writeAuditEvent } from "@/server/audit";

export interface MaterialInput {
  code: string;
  name: string;
  category: MaterialCategory;
  priceUnit: PriceUnit;
  isActive: boolean;
}

async function assertUniqueCode(
  db: DatabaseExecutor,
  organizationId: string,
  code: string,
  exceptId?: string,
): Promise<void> {
  const conditions = [eq(materials.organizationId, organizationId), eq(materials.code, code)];
  if (exceptId) conditions.push(ne(materials.id, exceptId));
  const [existing] = await db
    .select({ id: materials.id })
    .from(materials)
    .where(and(...conditions))
    .limit(1);
  if (existing) throw new DomainError("DUPLICATE_MATERIAL_CODE", { field: "code" });
}

async function requireMaterial(
  db: DatabaseExecutor,
  organizationId: string,
  materialId: string,
): Promise<void> {
  if (!isValidId(materialId)) throw new DomainError("MATERIAL_NOT_FOUND");
  const [existing] = await db
    .select({ id: materials.id })
    .from(materials)
    .where(and(eq(materials.organizationId, organizationId), eq(materials.id, materialId)))
    .limit(1);
  if (!existing) throw new DomainError("MATERIAL_NOT_FOUND");
}

export async function createMaterial(
  db: Database,
  organizationId: string,
  actorUserId: string,
  input: MaterialInput & { initialPriceCtsPerT: number },
): Promise<Material> {
  assertUnitPrice(input.initialPriceCtsPerT, "price");
  const id = randomUUID();
  const now = new Date();
  await withTransaction(db, async (tx) => {
    await assertUniqueCode(tx, organizationId, input.code);
    const [last] = await tx
      .select({ sortOrder: sql<number>`coalesce(max(${materials.sortOrder}), -1)` })
      .from(materials)
      .where(eq(materials.organizationId, organizationId));
    await tx.insert(materials).values({
      id,
      organizationId,
      code: input.code,
      name: input.name,
      category: input.category,
      priceUnit: input.priceUnit,
      currentPurchasePriceCtsPerT: input.initialPriceCtsPerT,
      isActive: input.isActive,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    });
    await tx.insert(materialPrices).values({
      id: randomUUID(),
      organizationId,
      materialId: id,
      purchasePriceCtsPerT: input.initialPriceCtsPerT,
      effectiveFrom: now,
      note: "Prix initial",
    });
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "MATERIAL_CREATED",
      entityType: "material",
      entityId: id,
      metadata: { code: input.code, name: input.name },
    });
  });
  const [created] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  if (!created) throw new Error("Material insert did not persist");
  return created;
}

export async function updateMaterial(
  db: Database,
  organizationId: string,
  materialId: string,
  actorUserId: string,
  input: MaterialInput,
): Promise<Material> {
  await withTransaction(db, async (tx) => {
    await requireMaterial(tx, organizationId, materialId);
    await assertUniqueCode(tx, organizationId, input.code, materialId);
    await tx.update(materials).set(input).where(eq(materials.id, materialId));
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "MATERIAL_UPDATED",
      entityType: "material",
      entityId: materialId,
      metadata: { code: input.code, name: input.name },
    });
  });
  const [updated] = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  if (!updated) throw new Error("Material update did not persist");
  return updated;
}

/**
 * Records a new purchase price. The price history keeps every change; the material's
 * current price is the latest entry. Storage is always centimes per tonne.
 */
export async function updateMaterialPrice(
  db: Database,
  organizationId: string,
  materialId: string,
  actorUserId: string,
  input: { priceCtsPerT: number; effectiveFrom: Date; note: string },
): Promise<void> {
  assertUnitPrice(input.priceCtsPerT, "price");
  await withTransaction(db, async (tx) => {
    await requireMaterial(tx, organizationId, materialId);
    await tx.insert(materialPrices).values({
      id: randomUUID(),
      organizationId,
      materialId,
      purchasePriceCtsPerT: input.priceCtsPerT,
      effectiveFrom: input.effectiveFrom,
      note: input.note,
    });
    await tx
      .update(materials)
      .set({ currentPurchasePriceCtsPerT: input.priceCtsPerT })
      .where(eq(materials.id, materialId));
    await writeAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: "MATERIAL_PRICE_CHANGED",
      entityType: "material",
      entityId: materialId,
      metadata: { priceCtsPerT: input.priceCtsPerT },
    });
  });
}
