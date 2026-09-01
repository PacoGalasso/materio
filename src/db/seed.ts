/**
 * Deterministic demo dataset generator. Rebuilds the whole workspace inside one transaction
 * so the application always lands on an internally consistent, current-looking dataset.
 *
 * All figures flow through the domain functions (net, total, movements), which guarantees
 * that tickets, movements and stock levels agree with each other.
 */
import { randomUUID } from "node:crypto";

import {
  adjustmentMovement,
  dispatchMovement,
  receiptFromCompletedWeighing,
} from "@/domain/inventory";
import { settleWeighing } from "@/domain/weighing";
import { formatPlateDisplay, normalizePlate } from "@/domain/weighing";
import { GRAMS_PER_KG } from "@/domain/units";
import { addDays, startOfDay, zonedDate, zonedParts } from "@/lib/time";

import { withTransaction, type Database } from "./client";
import {
  DEMO_CANCEL_NOTES,
  DEMO_DISPATCHES,
  DEMO_MATERIALS,
  DEMO_ORGANIZATION,
  DEMO_SUPPLIERS,
  DEMO_TICKET_NOTES,
  DEMO_YARD,
} from "./seed-data";
import {
  inventoryMovements,
  materialPrices,
  materials,
  organizations,
  suppliers,
  vehicles,
  weighingTickets,
  yards,
  type NewInventoryMovement,
  type NewWeighingTicket,
} from "./schema";

export interface SeedSummary {
  organizationId: string;
  yardId: string;
  materials: number;
  suppliers: number;
  vehicles: number;
  tickets: number;
  openTickets: number;
  movements: number;
}

export interface SeedOptions {
  /** Reference instant for "today". Defaults to the current time. */
  now?: Date;
  /** PRNG seed; the same seed yields the same dataset for the same `now`. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers (mulberry32)
// ---------------------------------------------------------------------------

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() called with an empty list");
  return item;
}

function weightedPick<T>(
  random: () => number,
  items: readonly T[],
  weightOf: (item: T) => number,
): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= weightOf(item);
    if (cursor <= 0) return item;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error("weightedPick() called with an empty list");
  return last;
}

/** Rounds a price to a "negotiable" step: CHF 0.05/kg or CHF 5/t (both = 5'000 cts/t). */
function roundPriceStep(ctsPerT: number, unit: "kg" | "t"): number {
  const step = unit === "kg" ? 5_000 : 500;
  return Math.max(0, Math.round(ctsPerT / step) * step);
}

function roundKg(kg: number, stepKg: number): number {
  return Math.round(kg / stepKg) * stepKg;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedDemoWorkspace(
  db: Database,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  const random = createRandom(options.seed ?? 20_260_901);
  const today = startOfDay(now);

  const organizationId = randomUUID();
  const yardId = randomUUID();

  // --- materials & price history -------------------------------------------------------
  type MaterialSeed = {
    id: string;
    code: string;
    priceUnit: "kg" | "t";
    priceCtsPerT: number;
    history: Array<{ effectiveFrom: Date; priceCtsPerT: number; note: string }>;
    typicalNetKg: [number, number];
    openingStockKg: number;
  };
  const materialSeeds: MaterialSeed[] = DEMO_MATERIALS.map((material) => {
    const base = material.priceCtsPerT;
    const history = [
      {
        effectiveFrom: addDays(today, -75),
        priceCtsPerT: roundPriceStep(base * 0.96, material.priceUnit),
        note: "Prix d'ouverture (démo)",
      },
      {
        effectiveFrom: addDays(today, -32),
        priceCtsPerT: roundPriceStep(base * 1.02, material.priceUnit),
        note: "Ajustement trimestriel",
      },
      {
        effectiveFrom: addDays(today, -9),
        priceCtsPerT: base,
        note: "Alignement sur le marché (démo)",
      },
    ];
    return {
      id: randomUUID(),
      code: material.code,
      priceUnit: material.priceUnit,
      priceCtsPerT: base,
      history,
      typicalNetKg: material.typicalNetKg,
      openingStockKg: material.openingStockKg,
    };
  });
  const materialByCode = new Map(materialSeeds.map((m) => [m.code, m]));

  const priceAt = (material: MaterialSeed, at: Date): number => {
    let price = material.history[0]?.priceCtsPerT ?? material.priceCtsPerT;
    for (const entry of material.history) {
      if (entry.effectiveFrom.getTime() <= at.getTime()) price = entry.priceCtsPerT;
    }
    return price;
  };

  // --- suppliers & vehicles ------------------------------------------------------------
  type VehicleSeed = {
    id: string;
    plate: string;
    plateDisplay: string;
    tareKg: number;
    maxPayloadKg: number;
  };
  type SupplierSeed = {
    id: string;
    name: string;
    frequency: number;
    vehicles: VehicleSeed[];
    materialWeights: Record<string, number>;
  };
  const supplierSeeds: SupplierSeed[] = DEMO_SUPPLIERS.map((supplier) => ({
    id: randomUUID(),
    name: supplier.name,
    frequency: supplier.frequency,
    materialWeights: supplier.materialWeights,
    vehicles: supplier.vehicles.map((vehicle) => ({
      id: randomUUID(),
      plate: normalizePlate(vehicle.plate),
      plateDisplay: formatPlateDisplay(vehicle.plate),
      tareKg: vehicle.tareKg,
      maxPayloadKg: vehicle.maxPayloadKg,
    })),
  }));

  // --- movements: opening balances -----------------------------------------------------
  const movements: NewInventoryMovement[] = [];
  const openingAt = zonedDate({
    ...zonedParts(addDays(today, -30)),
    hour: 7,
    minute: 0,
    second: 0,
  });
  for (const material of materialSeeds) {
    const figures = adjustmentMovement({
      quantityG: material.openingStockKg * GRAMS_PER_KG,
      unitValueCtsPerT: priceAt(material, openingAt),
    });
    movements.push({
      id: randomUUID(),
      organizationId,
      yardId,
      materialId: material.id,
      weighingTicketId: null,
      ...figures,
      occurredAt: openingAt,
      note: "Inventaire d'ouverture (données de démonstration)",
    });
  }

  // --- weighing tickets ----------------------------------------------------------------
  type TicketDraft = Omit<NewWeighingTicket, "reference"> & { id: string };
  const drafts: TicketDraft[] = [];
  let cancelledLeft = DEMO_CANCEL_NOTES.length;

  const makeTicket = (grossAt: Date, outcome: "completed" | "open" | "cancelled"): TicketDraft => {
    const supplier = weightedPick(random, supplierSeeds, (s) => s.frequency);
    const vehicle = pick(random, supplier.vehicles);
    const materialCodes = Object.keys(supplier.materialWeights);
    const materialCode = weightedPick(
      random,
      materialCodes,
      (code) => supplier.materialWeights[code] ?? 1,
    );
    const material = materialByCode.get(materialCode);
    if (!material) throw new Error(`Unknown material ${materialCode}`);

    const [minKg, maxKg] = material.typicalNetKg;
    const netKg = Math.max(
      20,
      Math.min(vehicle.maxPayloadKg, roundKg(minKg + random() * (maxKg - minKg), 10)),
    );
    const tareKg = roundKg(vehicle.tareKg * (0.985 + random() * 0.03), 10);
    const grossKg = tareKg + netKg;

    const listPrice = priceAt(material, grossAt);
    const negotiated = random() < 0.2;
    const unitPriceCtsPerT = negotiated
      ? roundPriceStep(listPrice * (0.96 + random() * 0.08), material.priceUnit)
      : listPrice;

    const base: TicketDraft = {
      id: randomUUID(),
      organizationId,
      yardId,
      status: "open",
      supplierId: supplier.id,
      vehicleId: vehicle.id,
      plateSnapshot: vehicle.plateDisplay,
      materialId: material.id,
      unitPriceCtsPerT,
      grossWeightG: grossKg * GRAMS_PER_KG,
      grossWeighedAt: grossAt,
      tareWeightG: null,
      tareWeighedAt: null,
      netWeightG: null,
      totalAmountCts: null,
      externalReference: random() < 0.35 ? `BL-${randInt(random, 1000, 9999)}` : "",
      notes: negotiated ? "Prix convenu avec le fournisseur." : pick(random, DEMO_TICKET_NOTES),
      completedAt: null,
      cancelledAt: null,
      createdAt: grossAt,
      updatedAt: grossAt,
    };

    if (outcome === "open") return base;

    if (outcome === "cancelled") {
      const cancelledAt = new Date(grossAt.getTime() + randInt(random, 10, 25) * 60_000);
      return {
        ...base,
        status: "cancelled",
        notes: DEMO_CANCEL_NOTES[DEMO_CANCEL_NOTES.length - cancelledLeft] ?? "",
        cancelledAt,
        updatedAt: cancelledAt,
      };
    }

    const tareAt = new Date(grossAt.getTime() + randInt(random, 18, 85) * 60_000);
    const figures = settleWeighing({
      grossWeightG: grossKg * GRAMS_PER_KG,
      tareWeightG: tareKg * GRAMS_PER_KG,
      unitPriceCtsPerT,
    });
    const receipt = receiptFromCompletedWeighing(figures);
    movements.push({
      id: randomUUID(),
      organizationId,
      yardId,
      materialId: material.id,
      weighingTicketId: base.id,
      ...receipt,
      occurredAt: tareAt,
      note: "",
    });
    return {
      ...base,
      status: "completed",
      tareWeightG: figures.tareWeightG,
      tareWeighedAt: tareAt,
      netWeightG: figures.netWeightG,
      totalAmountCts: figures.totalAmountCts,
      completedAt: tareAt,
      updatedAt: tareAt,
    };
  };

  // Past days: 21 days of history, no Sundays, lighter Saturdays.
  for (let daysAgo = 21; daysAgo >= 1; daysAgo -= 1) {
    const day = addDays(today, -daysAgo);
    const weekday = zonedParts(day).weekday;
    if (weekday === 0) continue;
    const count = weekday === 6 ? randInt(random, 0, 1) : randInt(random, 2, 4);
    const minutes = new Set<number>();
    while (minutes.size < count) minutes.add(randInt(random, 7 * 60 + 15, 16 * 60 + 45));
    for (const minute of [...minutes].sort((a, b) => a - b)) {
      const grossAt = zonedDate({
        ...zonedParts(day),
        hour: Math.floor(minute / 60),
        minute: minute % 60,
        second: randInt(random, 0, 59),
      });
      const cancel = cancelledLeft > 0 && daysAgo <= 12 && random() < 0.08;
      drafts.push(makeTicket(grossAt, cancel ? "cancelled" : "completed"));
      if (cancel) cancelledLeft -= 1;
    }
  }

  // Today: a few completed tickets earlier, then open tickets awaiting their tare.
  const openCount = 4;
  const completedTodayCount = 3;
  let cursor = new Date(now.getTime() - 6 * 60_000);
  const todayTickets: Array<{ grossAt: Date; outcome: "completed" | "open" }> = [];
  for (let i = 0; i < openCount; i += 1) {
    todayTickets.push({ grossAt: cursor, outcome: "open" });
    cursor = new Date(cursor.getTime() - randInt(random, 14, 32) * 60_000);
  }
  cursor = new Date(cursor.getTime() - 60 * 60_000);
  for (let i = 0; i < completedTodayCount; i += 1) {
    todayTickets.push({ grossAt: cursor, outcome: "completed" });
    cursor = new Date(cursor.getTime() - randInt(random, 25, 55) * 60_000);
  }
  for (const entry of todayTickets.reverse()) {
    const draft = makeTicket(entry.grossAt, entry.outcome);
    if (entry.outcome === "completed" && draft.tareWeighedAt && draft.tareWeighedAt > now) {
      // Keep completed tickets strictly in the past.
      const shift = draft.tareWeighedAt.getTime() - now.getTime() + 60_000;
      draft.tareWeighedAt = new Date(draft.tareWeighedAt.getTime() - shift);
      draft.completedAt = draft.tareWeighedAt;
      draft.updatedAt = draft.tareWeighedAt;
      const movement = movements.find((m) => m.weighingTicketId === draft.id);
      if (movement) movement.occurredAt = draft.tareWeighedAt;
    }
    drafts.push(draft);
  }

  // References follow chronological order of the gross weighing.
  drafts.sort((a, b) => a.grossWeighedAt.getTime() - b.grossWeighedAt.getTime());
  const tickets: NewWeighingTicket[] = drafts.map((draft, index) => ({
    ...draft,
    reference: `${DEMO_ORGANIZATION.ticketPrefix}-${zonedParts(draft.grossWeighedAt).year}-${String(index + 1).padStart(5, "0")}`,
  }));

  // --- dispatches (secondary flow): never below stock on hand at that instant ------------
  const stockAt = (materialId: string, at: Date): number =>
    movements
      .filter((m) => m.materialId === materialId && m.occurredAt.getTime() <= at.getTime())
      .reduce((sum, m) => sum + m.quantityG, 0);

  for (const dispatch of DEMO_DISPATCHES) {
    const material = materialByCode.get(dispatch.materialCode);
    if (!material) throw new Error(`Unknown material ${dispatch.materialCode}`);
    const day = addDays(today, -dispatch.daysAgo);
    let occurredAt = zonedDate({
      ...zonedParts(day),
      hour: randInt(random, 9, 15),
      minute: randInt(random, 0, 59),
    });
    if (occurredAt > now) occurredAt = new Date(now.getTime() - 30 * 60_000);
    const onHand = stockAt(material.id, occurredAt);
    const quantityG =
      Math.floor((onHand * dispatch.share) / (10 * GRAMS_PER_KG)) * 10 * GRAMS_PER_KG;
    if (quantityG < 100 * GRAMS_PER_KG) continue;
    const unitValueCtsPerT = roundPriceStep(
      priceAt(material, occurredAt) * 1.08,
      material.priceUnit,
    );
    const figures = dispatchMovement({ quantityG, unitValueCtsPerT, currentStockG: onHand });
    movements.push({
      id: randomUUID(),
      organizationId,
      yardId,
      materialId: material.id,
      weighingTicketId: null,
      ...figures,
      occurredAt,
      note: `Expédition · ${dispatch.destination}`,
    });
  }

  // --- consistency checks --------------------------------------------------------------
  movements.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const running = new Map<string, number>();
  for (const movement of movements) {
    const next = (running.get(movement.materialId) ?? 0) + movement.quantityG;
    if (next < 0)
      throw new Error(`Seed inconsistency: negative stock for material ${movement.materialId}`);
    running.set(movement.materialId, next);
  }
  for (const ticket of tickets) {
    if (ticket.status === "completed") {
      const movement = movements.find((m) => m.weighingTicketId === ticket.id);
      if (
        !movement ||
        movement.quantityG !== ticket.netWeightG ||
        movement.amountCts !== ticket.totalAmountCts
      ) {
        throw new Error(
          `Seed inconsistency: ticket ${ticket.reference} does not match its movement`,
        );
      }
    }
  }

  // --- write everything in one transaction --------------------------------------------
  await withTransaction(db, async (tx) => {
    await tx.delete(inventoryMovements);
    await tx.delete(weighingTickets);
    await tx.delete(materialPrices);
    await tx.delete(vehicles);
    await tx.delete(materials);
    await tx.delete(suppliers);
    await tx.delete(yards);
    await tx.delete(organizations);

    await tx.insert(organizations).values({
      id: organizationId,
      ...DEMO_ORGANIZATION,
      nextTicketNumber: tickets.length + 1,
    });
    await tx.insert(yards).values({ id: yardId, organizationId, ...DEMO_YARD, isDefault: true });

    await tx.insert(materials).values(
      DEMO_MATERIALS.map((material, index) => {
        const seed = materialSeeds[index];
        if (!seed) throw new Error("material seed mismatch");
        return {
          id: seed.id,
          organizationId,
          code: material.code,
          name: material.name,
          category: material.category,
          priceUnit: material.priceUnit,
          currentPurchasePriceCtsPerT: material.priceCtsPerT,
          isActive: true,
          sortOrder: index,
        };
      }),
    );
    await tx.insert(materialPrices).values(
      materialSeeds.flatMap((material) =>
        material.history.map((entry) => ({
          id: randomUUID(),
          materialId: material.id,
          purchasePriceCtsPerT: entry.priceCtsPerT,
          effectiveFrom: entry.effectiveFrom,
          note: entry.note,
        })),
      ),
    );

    await tx.insert(suppliers).values(
      DEMO_SUPPLIERS.map((supplier, index) => {
        const seed = supplierSeeds[index];
        if (!seed) throw new Error("supplier seed mismatch");
        return {
          id: seed.id,
          organizationId,
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          street: supplier.street,
          postalCode: supplier.postalCode,
          city: supplier.city,
          canton: supplier.canton,
          vatNumber: supplier.vatNumber,
          notes: supplier.notes,
          isActive: true,
        };
      }),
    );
    await tx.insert(vehicles).values(
      supplierSeeds.flatMap((supplier, supplierIndex) =>
        supplier.vehicles.map((vehicle, vehicleIndex) => ({
          id: vehicle.id,
          organizationId,
          supplierId: supplier.id,
          plate: vehicle.plate,
          plateDisplay: vehicle.plateDisplay,
          description: DEMO_SUPPLIERS[supplierIndex]?.vehicles[vehicleIndex]?.description ?? "",
        })),
      ),
    );

    for (let i = 0; i < tickets.length; i += 25) {
      await tx.insert(weighingTickets).values(tickets.slice(i, i + 25));
    }
    for (let i = 0; i < movements.length; i += 25) {
      await tx.insert(inventoryMovements).values(movements.slice(i, i + 25));
    }
  });

  return {
    organizationId,
    yardId,
    materials: materialSeeds.length,
    suppliers: supplierSeeds.length,
    vehicles: supplierSeeds.reduce((sum, s) => sum + s.vehicles.length, 0),
    tickets: tickets.length,
    openTickets: tickets.filter((t) => t.status === "open").length,
    movements: movements.length,
  };
}
