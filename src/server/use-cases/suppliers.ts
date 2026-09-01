import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { withTransaction, type Database, type DatabaseExecutor } from "@/db/client";
import { suppliers, vehicles, type Supplier } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { formatPlateDisplay, normalizePlate } from "@/domain/weighing";
import { isValidId } from "@/lib/id";

export interface SupplierInput {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  canton: string;
  vatNumber: string;
  notes: string;
  isActive: boolean;
}

export const EMPTY_SUPPLIER_INPUT: SupplierInput = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  canton: "",
  vatNumber: "",
  notes: "",
  isActive: true,
};

async function requireSupplier(
  db: DatabaseExecutor,
  organizationId: string,
  supplierId: string,
): Promise<void> {
  if (!isValidId(supplierId)) throw new DomainError("SUPPLIER_NOT_FOUND");
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, supplierId)))
    .limit(1);
  if (!supplier) throw new DomainError("SUPPLIER_NOT_FOUND");
}

export async function createSupplier(
  db: Database,
  organizationId: string,
  input: SupplierInput,
): Promise<Supplier> {
  const id = randomUUID();
  await withTransaction(db, async (tx) => {
    await tx.insert(suppliers).values({ id, organizationId, ...input });
  });
  const [created] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!created) throw new Error("Supplier insert did not persist");
  return created;
}

export async function updateSupplier(
  db: Database,
  organizationId: string,
  supplierId: string,
  input: SupplierInput,
): Promise<Supplier> {
  await withTransaction(db, async (tx) => {
    await requireSupplier(tx, organizationId, supplierId);
    await tx.update(suppliers).set(input).where(eq(suppliers.id, supplierId));
  });
  const [updated] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!updated) throw new Error("Supplier update did not persist");
  return updated;
}

export async function addSupplierVehicle(
  db: Database,
  organizationId: string,
  supplierId: string,
  input: { plate: string; description: string },
): Promise<{ id: string }> {
  const plate = normalizePlate(input.plate);
  if (plate.length === 0) throw new DomainError("PLATE_MISSING", { field: "plate" });
  return withTransaction(db, async (tx) => {
    await requireSupplier(tx, organizationId, supplierId);
    const [existing] = await tx
      .select({ id: vehicles.id, supplierId: vehicles.supplierId })
      .from(vehicles)
      .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.plate, plate)))
      .limit(1);
    if (existing) {
      if (existing.supplierId && existing.supplierId !== supplierId) {
        throw new DomainError("DUPLICATE_PLATE", { field: "plate" });
      }
      await tx
        .update(vehicles)
        .set({ supplierId, description: input.description })
        .where(eq(vehicles.id, existing.id));
      return { id: existing.id };
    }
    const id = randomUUID();
    await tx.insert(vehicles).values({
      id,
      organizationId,
      supplierId,
      plate,
      plateDisplay: formatPlateDisplay(input.plate),
      description: input.description,
    });
    return { id };
  });
}

export async function removeSupplierVehicle(
  db: Database,
  organizationId: string,
  vehicleId: string,
): Promise<void> {
  // Tickets keep their plate snapshot; the FK is ON DELETE SET NULL.
  if (!isValidId(vehicleId)) return;
  await withTransaction(db, async (tx) => {
    await tx
      .delete(vehicles)
      .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId)));
  });
}
