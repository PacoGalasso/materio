import { and, asc, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  inventoryMovements,
  materials,
  suppliers,
  vehicles,
  weighingTickets,
  yards,
  type InventoryMovement,
  type Material,
  type MaterialCategory,
  type PriceUnit,
  type Supplier,
  type Vehicle,
  type WeighingStatus,
  type WeighingTicket,
  type Yard,
} from "@/db/schema";
import { normalizePlate } from "@/domain/weighing";

export interface TicketRow {
  id: string;
  reference: string;
  status: WeighingStatus;
  grossWeighedAt: Date;
  completedAt: Date | null;
  supplierId: string;
  supplierName: string;
  plateSnapshot: string;
  materialId: string;
  materialName: string;
  materialCategory: MaterialCategory;
  priceUnit: PriceUnit;
  grossWeightG: number;
  tareWeightG: number | null;
  netWeightG: number | null;
  unitPriceCtsPerT: number;
  totalAmountCts: number | null;
}

export const TICKET_SORT_KEYS = [
  "date",
  "reference",
  "supplier",
  "material",
  "net",
  "total",
  "status",
] as const;
export type TicketSortKey = (typeof TICKET_SORT_KEYS)[number];

export interface TicketListFilters {
  q?: string;
  status?: WeighingStatus | "all";
  materialId?: string;
  supplierId?: string;
  /** Inclusive lower bound on the gross weighing instant. */
  from?: Date;
  /** Exclusive upper bound on the gross weighing instant. */
  to?: Date;
  sort?: TicketSortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface TicketListResult {
  rows: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const ROW_SELECT = {
  id: weighingTickets.id,
  reference: weighingTickets.reference,
  status: weighingTickets.status,
  grossWeighedAt: weighingTickets.grossWeighedAt,
  completedAt: weighingTickets.completedAt,
  supplierId: weighingTickets.supplierId,
  supplierName: suppliers.name,
  plateSnapshot: weighingTickets.plateSnapshot,
  materialId: weighingTickets.materialId,
  materialName: materials.name,
  materialCategory: materials.category,
  priceUnit: materials.priceUnit,
  grossWeightG: weighingTickets.grossWeightG,
  tareWeightG: weighingTickets.tareWeightG,
  netWeightG: weighingTickets.netWeightG,
  unitPriceCtsPerT: weighingTickets.unitPriceCtsPerT,
  totalAmountCts: weighingTickets.totalAmountCts,
} as const;

function sortExpression(sort: TicketSortKey, dir: "asc" | "desc"): SQL[] {
  const direction = dir === "asc" ? asc : desc;
  switch (sort) {
    case "reference":
      return [direction(weighingTickets.reference)];
    case "supplier":
      return [direction(suppliers.name), desc(weighingTickets.grossWeighedAt)];
    case "material":
      return [direction(materials.name), desc(weighingTickets.grossWeighedAt)];
    case "net":
      return [direction(weighingTickets.netWeightG), desc(weighingTickets.grossWeighedAt)];
    case "total":
      return [direction(weighingTickets.totalAmountCts), desc(weighingTickets.grossWeighedAt)];
    case "status":
      return [direction(weighingTickets.status), desc(weighingTickets.grossWeighedAt)];
    case "date":
    default:
      return [direction(weighingTickets.grossWeighedAt), direction(weighingTickets.reference)];
  }
}

export async function listTickets(
  organizationId: string,
  filters: TicketListFilters = {},
): Promise<TicketListResult> {
  const db = await getDb();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 5), 100);
  const conditions: SQL[] = [eq(weighingTickets.organizationId, organizationId)];

  if (filters.status && filters.status !== "all")
    conditions.push(eq(weighingTickets.status, filters.status));
  if (filters.materialId) conditions.push(eq(weighingTickets.materialId, filters.materialId));
  if (filters.supplierId) conditions.push(eq(weighingTickets.supplierId, filters.supplierId));
  if (filters.from) conditions.push(gte(weighingTickets.grossWeighedAt, filters.from));
  if (filters.to) conditions.push(lt(weighingTickets.grossWeighedAt, filters.to));

  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q.toLowerCase()}%`;
    const platePattern = `%${normalizePlate(q)}%`;
    const searchClauses: SQL[] = [
      sql`lower(${weighingTickets.reference}) like ${pattern}`,
      sql`lower(${suppliers.name}) like ${pattern}`,
      sql`lower(${weighingTickets.externalReference}) like ${pattern}`,
    ];
    if (normalizePlate(q).length > 0) {
      searchClauses.push(
        sql`replace(upper(${weighingTickets.plateSnapshot}), ' ', '') like ${platePattern}`,
      );
    }
    const search = or(...searchClauses);
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(weighingTickets)
    .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(filters.page ?? 1, 1), pageCount);

  const rows = await db
    .select(ROW_SELECT)
    .from(weighingTickets)
    .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
    .where(where)
    .orderBy(...sortExpression(filters.sort ?? "date", filters.dir ?? "desc"))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows, total, page, pageSize, pageCount };
}

/** Open tickets, oldest first: the operator's "to finish" list. */
export async function listOpenTickets(organizationId: string, limit = 50): Promise<TicketRow[]> {
  const db = await getDb();
  return db
    .select(ROW_SELECT)
    .from(weighingTickets)
    .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
    .where(
      and(eq(weighingTickets.organizationId, organizationId), eq(weighingTickets.status, "open")),
    )
    .orderBy(asc(weighingTickets.grossWeighedAt))
    .limit(limit);
}

/** Latest completed tickets (dashboard). */
export async function listRecentCompletedTickets(
  organizationId: string,
  limit = 8,
): Promise<TicketRow[]> {
  const db = await getDb();
  return db
    .select(ROW_SELECT)
    .from(weighingTickets)
    .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
    .where(
      and(
        eq(weighingTickets.organizationId, organizationId),
        eq(weighingTickets.status, "completed"),
      ),
    )
    .orderBy(desc(weighingTickets.completedAt), desc(weighingTickets.reference))
    .limit(limit);
}

export interface TicketDetail {
  ticket: WeighingTicket;
  supplier: Supplier;
  material: Material;
  vehicle: Vehicle | null;
  yard: Yard;
  movement: InventoryMovement | null;
}

export async function getTicketDetail(
  organizationId: string,
  ticketId: string,
): Promise<TicketDetail | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      ticket: weighingTickets,
      supplier: suppliers,
      material: materials,
      vehicle: vehicles,
      yard: yards,
      movement: inventoryMovements,
    })
    .from(weighingTickets)
    .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
    .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
    .innerJoin(yards, eq(yards.id, weighingTickets.yardId))
    .leftJoin(vehicles, eq(vehicles.id, weighingTickets.vehicleId))
    .leftJoin(inventoryMovements, eq(inventoryMovements.weighingTicketId, weighingTickets.id))
    .where(
      and(eq(weighingTickets.organizationId, organizationId), eq(weighingTickets.id, ticketId)),
    )
    .limit(1);
  return row ?? null;
}
