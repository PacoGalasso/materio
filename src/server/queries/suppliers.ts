import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { suppliers, vehicles, weighingTickets, type Supplier, type Vehicle } from "@/db/schema";

export interface SupplierRow extends Supplier {
  ticketCount: number;
  completedCount: number;
  lastDeliveryAt: Date | null;
  totalPurchasedCts: number;
  totalReceivedG: number;
}

export async function listSuppliers(
  organizationId: string,
  options: { q?: string; includeInactive?: boolean } = {},
): Promise<SupplierRow[]> {
  const db = await getDb();
  const conditions: SQL[] = [eq(suppliers.organizationId, organizationId)];
  if (!options.includeInactive) conditions.push(eq(suppliers.isActive, true));
  const q = options.q?.trim().toLowerCase();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      sql`(lower(${suppliers.name}) like ${pattern} or lower(${suppliers.city}) like ${pattern} or lower(${suppliers.contactName}) like ${pattern})`,
    );
  }

  const rows = await db
    .select({
      supplier: suppliers,
      ticketCount: sql<number>`count(${weighingTickets.id})`,
      completedCount: sql<number>`coalesce(sum(case when ${weighingTickets.status} = 'completed' then 1 else 0 end), 0)`,
      lastDeliveryAt: sql<number | null>`max(${weighingTickets.grossWeighedAt})`,
      totalPurchasedCts: sql<number>`coalesce(sum(case when ${weighingTickets.status} = 'completed' then ${weighingTickets.totalAmountCts} else 0 end), 0)`,
      totalReceivedG: sql<number>`coalesce(sum(case when ${weighingTickets.status} = 'completed' then ${weighingTickets.netWeightG} else 0 end), 0)`,
    })
    .from(suppliers)
    .leftJoin(weighingTickets, eq(weighingTickets.supplierId, suppliers.id))
    .where(and(...conditions))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));

  return rows.map((row) => ({
    ...row.supplier,
    ticketCount: row.ticketCount,
    completedCount: row.completedCount,
    lastDeliveryAt: row.lastDeliveryAt === null ? null : new Date(row.lastDeliveryAt),
    totalPurchasedCts: row.totalPurchasedCts,
    totalReceivedG: row.totalReceivedG,
  }));
}

export async function getSupplier(
  organizationId: string,
  supplierId: string,
): Promise<Supplier | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, supplierId)))
    .limit(1);
  return row ?? null;
}

export async function listSupplierVehicles(supplierId: string): Promise<Vehicle[]> {
  const db = await getDb();
  return db
    .select()
    .from(vehicles)
    .where(eq(vehicles.supplierId, supplierId))
    .orderBy(asc(vehicles.plateDisplay));
}

export interface SupplierOption {
  id: string;
  name: string;
  city: string;
  vehicles: Array<{ id: string; plateDisplay: string; description: string }>;
}

/** Active suppliers with their vehicles, for the weighing form selectors. */
export async function listSupplierOptions(organizationId: string): Promise<SupplierOption[]> {
  const db = await getDb();
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name, city: suppliers.city })
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.isActive, true)))
    .orderBy(asc(suppliers.name));
  const vehicleRows = await db
    .select({
      id: vehicles.id,
      supplierId: vehicles.supplierId,
      plateDisplay: vehicles.plateDisplay,
      description: vehicles.description,
    })
    .from(vehicles)
    .where(eq(vehicles.organizationId, organizationId))
    .orderBy(desc(vehicles.updatedAt));

  const bySupplier = new Map<string, SupplierOption["vehicles"]>();
  for (const vehicle of vehicleRows) {
    if (!vehicle.supplierId) continue;
    const list = bySupplier.get(vehicle.supplierId) ?? [];
    list.push({
      id: vehicle.id,
      plateDisplay: vehicle.plateDisplay,
      description: vehicle.description,
    });
    bySupplier.set(vehicle.supplierId, list);
  }
  return supplierRows.map((supplier) => ({
    ...supplier,
    vehicles: bySupplier.get(supplier.id) ?? [],
  }));
}
