import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { inventoryMovements, materials, suppliers, weighingTickets } from "@/db/schema";
import { addDays, dayKey, startOfDay } from "@/lib/time";

import { getStockOverview, type StockOverview } from "./inventory";
import { listOpenTickets, type TicketRow } from "./tickets";

export interface DailyActivity {
  day: Date;
  key: string;
  receivedG: number;
  dispatchedG: number;
  receipts: number;
}

export interface DashboardData {
  now: Date;
  today: {
    receivedG: number;
    receipts: number;
    purchasedCts: number;
    dispatchedG: number;
    dispatches: number;
    weighings: number;
  };
  openTickets: TicketRow[];
  stock: StockOverview;
  activity: DailyActivity[];
  recentTickets: TicketRow[];
}

export async function getDashboard(
  organizationId: string,
  now: Date = new Date(),
): Promise<DashboardData> {
  const db = await getDb();
  const todayStart = startOfDay(now);
  const windowDays = 14;
  const windowStart = addDays(todayStart, -(windowDays - 1));

  const [todayMovements, todayWeighings, windowMovements, openTickets, stock, recentTickets] =
    await Promise.all([
      db
        .select({
          type: inventoryMovements.type,
          quantityG: inventoryMovements.quantityG,
          amountCts: inventoryMovements.amountCts,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.organizationId, organizationId),
            gte(inventoryMovements.occurredAt, todayStart),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(weighingTickets)
        .where(
          and(
            eq(weighingTickets.organizationId, organizationId),
            gte(weighingTickets.grossWeighedAt, todayStart),
          ),
        ),
      db
        .select({
          type: inventoryMovements.type,
          quantityG: inventoryMovements.quantityG,
          occurredAt: inventoryMovements.occurredAt,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.organizationId, organizationId),
            gte(inventoryMovements.occurredAt, windowStart),
          ),
        ),
      listOpenTickets(organizationId, 20),
      getStockOverview(organizationId, now),
      db
        .select({
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
        })
        .from(weighingTickets)
        .innerJoin(suppliers, eq(suppliers.id, weighingTickets.supplierId))
        .innerJoin(materials, eq(materials.id, weighingTickets.materialId))
        .where(
          and(
            eq(weighingTickets.organizationId, organizationId),
            eq(weighingTickets.status, "completed"),
          ),
        )
        .orderBy(desc(weighingTickets.completedAt))
        .limit(8),
    ]);

  const receiptsToday = todayMovements.filter((m) => m.type === "receipt");
  const dispatchesToday = todayMovements.filter((m) => m.type === "dispatch");

  const byDay = new Map<string, DailyActivity>();
  for (let i = 0; i < windowDays; i += 1) {
    const day = addDays(windowStart, i);
    const key = dayKey(day);
    byDay.set(key, { day, key, receivedG: 0, dispatchedG: 0, receipts: 0 });
  }
  for (const movement of windowMovements) {
    const bucket = byDay.get(dayKey(movement.occurredAt));
    if (!bucket) continue;
    if (movement.type === "receipt") {
      bucket.receivedG += movement.quantityG;
      bucket.receipts += 1;
    } else if (movement.type === "dispatch") {
      bucket.dispatchedG += -movement.quantityG;
    }
  }

  return {
    now,
    today: {
      receivedG: receiptsToday.reduce((sum, m) => sum + m.quantityG, 0),
      receipts: receiptsToday.length,
      purchasedCts: receiptsToday.reduce((sum, m) => sum + m.amountCts, 0),
      dispatchedG: dispatchesToday.reduce((sum, m) => sum - m.quantityG, 0),
      dispatches: dispatchesToday.length,
      weighings: todayWeighings[0]?.count ?? 0,
    },
    openTickets,
    stock,
    activity: [...byDay.values()],
    recentTickets,
  };
}
