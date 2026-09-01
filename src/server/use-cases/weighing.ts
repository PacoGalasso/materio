/**
 * Weighing ticket use cases. Each function receives the organization explicitly and runs
 * its writes inside one transaction so a ticket and its inventory movement never diverge.
 */
import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import {
  withTransaction,
  type Database,
  type DatabaseExecutor,
  type Transaction,
} from "@/db/client";
import {
  inventoryMovements,
  materials,
  organizations,
  suppliers,
  vehicles,
  weighingTickets,
  type WeighingTicket,
} from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { receiptFromCompletedWeighing } from "@/domain/inventory";
import { assertTransition } from "@/domain/status";
import { assertUnitPrice, assertWeight } from "@/domain/units";
import {
  checkCompletion,
  formatPlateDisplay,
  normalizePlate,
  settleWeighing,
} from "@/domain/weighing";
import { isValidId } from "@/lib/id";
import { zonedParts } from "@/lib/time";

export interface CreateWeighingInput {
  supplierId: string;
  plate: string;
  materialId: string;
  unitPriceCtsPerT: number;
  grossWeightG: number;
  grossWeighedAt: Date;
  tareWeightG: number | null;
  tareWeighedAt: Date | null;
  externalReference: string;
  notes: string;
}

export interface CreateWeighingResult {
  id: string;
  reference: string;
  status: "open" | "completed";
}

async function requireActiveSupplier(
  db: DatabaseExecutor,
  organizationId: string,
  supplierId: string,
) {
  if (!isValidId(supplierId)) throw new DomainError("SUPPLIER_NOT_FOUND", { field: "supplierId" });
  const [supplier] = await db
    .select({ id: suppliers.id, isActive: suppliers.isActive })
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, supplierId)))
    .limit(1);
  if (!supplier) throw new DomainError("SUPPLIER_NOT_FOUND", { field: "supplierId" });
  if (!supplier.isActive) throw new DomainError("SUPPLIER_INACTIVE", { field: "supplierId" });
  return supplier;
}

async function requireActiveMaterial(
  db: DatabaseExecutor,
  organizationId: string,
  materialId: string,
) {
  if (!isValidId(materialId)) throw new DomainError("MATERIAL_NOT_FOUND", { field: "materialId" });
  const [material] = await db
    .select({ id: materials.id, isActive: materials.isActive })
    .from(materials)
    .where(and(eq(materials.organizationId, organizationId), eq(materials.id, materialId)))
    .limit(1);
  if (!material) throw new DomainError("MATERIAL_NOT_FOUND", { field: "materialId" });
  if (!material.isActive) throw new DomainError("MATERIAL_INACTIVE", { field: "materialId" });
  return material;
}

/** Finds the vehicle by normalized plate or creates it for the supplier. */
async function resolveVehicle(
  tx: DatabaseExecutor,
  organizationId: string,
  supplierId: string,
  plateInput: string,
): Promise<{ vehicleId: string; plateDisplay: string }> {
  const plate = normalizePlate(plateInput);
  if (plate.length === 0) throw new DomainError("PLATE_MISSING", { field: "plate" });
  const plateDisplay = formatPlateDisplay(plateInput);
  const [existing] = await tx
    .select({
      id: vehicles.id,
      plateDisplay: vehicles.plateDisplay,
      supplierId: vehicles.supplierId,
    })
    .from(vehicles)
    .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.plate, plate)))
    .limit(1);
  if (existing) {
    if (!existing.supplierId) {
      await tx.update(vehicles).set({ supplierId }).where(eq(vehicles.id, existing.id));
    }
    return { vehicleId: existing.id, plateDisplay: existing.plateDisplay };
  }
  const id = randomUUID();
  await tx
    .insert(vehicles)
    .values({ id, organizationId, supplierId, plate, plateDisplay, description: "" });
  return { vehicleId: id, plateDisplay };
}

/** Allocates the next sequential reference for the organization (inside the caller's transaction). */
async function allocateReference(
  tx: DatabaseExecutor,
  organizationId: string,
  at: Date,
): Promise<string> {
  const [row] = await tx
    .update(organizations)
    .set({ nextTicketNumber: sql`${organizations.nextTicketNumber} + 1` })
    .where(eq(organizations.id, organizationId))
    .returning({ next: organizations.nextTicketNumber, prefix: organizations.ticketPrefix });
  if (!row)
    throw new Error(`Organization ${organizationId} not found while allocating a reference`);
  const number = row.next - 1;
  return `${row.prefix}-${zonedParts(at).year}-${String(number).padStart(5, "0")}`;
}

export async function createWeighingTicket(
  db: Database,
  organizationId: string,
  yardId: string,
  input: CreateWeighingInput,
): Promise<CreateWeighingResult> {
  assertWeight(input.grossWeightG, "grossWeight");
  assertUnitPrice(input.unitPriceCtsPerT, "unitPrice");
  if (input.tareWeightG !== null) assertWeight(input.tareWeightG, "tareWeight");
  const figures =
    input.tareWeightG === null
      ? null
      : settleWeighing({
          grossWeightG: input.grossWeightG,
          tareWeightG: input.tareWeightG,
          unitPriceCtsPerT: input.unitPriceCtsPerT,
        });

  return withTransaction(db, async (tx) => {
    await requireActiveSupplier(tx, organizationId, input.supplierId);
    await requireActiveMaterial(tx, organizationId, input.materialId);
    const { vehicleId, plateDisplay } = await resolveVehicle(
      tx,
      organizationId,
      input.supplierId,
      input.plate,
    );
    const reference = await allocateReference(tx, organizationId, input.grossWeighedAt);
    const id = randomUUID();
    const tareWeighedAt = figures ? (input.tareWeighedAt ?? input.grossWeighedAt) : null;
    const completedAt = figures ? (tareWeighedAt ?? input.grossWeighedAt) : null;

    await tx.insert(weighingTickets).values({
      id,
      organizationId,
      yardId,
      reference,
      status: figures ? "completed" : "open",
      supplierId: input.supplierId,
      vehicleId,
      plateSnapshot: plateDisplay,
      materialId: input.materialId,
      unitPriceCtsPerT: input.unitPriceCtsPerT,
      grossWeightG: input.grossWeightG,
      grossWeighedAt: input.grossWeighedAt,
      tareWeightG: figures?.tareWeightG ?? null,
      tareWeighedAt,
      netWeightG: figures?.netWeightG ?? null,
      totalAmountCts: figures?.totalAmountCts ?? null,
      externalReference: input.externalReference,
      notes: input.notes,
      completedAt,
    });

    if (figures && completedAt) {
      const receipt = receiptFromCompletedWeighing(figures);
      await tx.insert(inventoryMovements).values({
        id: randomUUID(),
        organizationId,
        yardId,
        materialId: input.materialId,
        weighingTicketId: id,
        ...receipt,
        occurredAt: completedAt,
        note: "",
      });
    }

    return { id, reference, status: figures ? "completed" : "open" };
  });
}

export interface CompleteWeighingInput {
  tareWeightG: number;
  tareWeighedAt: Date;
  /** Optional price confirmation at completion; defaults to the price recorded at arrival. */
  unitPriceCtsPerT?: number;
  notes?: string;
}

/**
 * Locks the ticket row (`FOR UPDATE`) so two concurrent completions/cancellations of the
 * same ticket serialize: the second transaction blocks until the first commits, then sees
 * the already-transitioned status and fails the transition check below instead of racing.
 */
async function requireTicket(
  tx: Transaction,
  organizationId: string,
  ticketId: string,
): Promise<WeighingTicket> {
  if (!isValidId(ticketId)) throw new DomainError("TICKET_NOT_FOUND");
  const [ticket] = await tx
    .select()
    .from(weighingTickets)
    .where(
      and(eq(weighingTickets.organizationId, organizationId), eq(weighingTickets.id, ticketId)),
    )
    .for("update")
    .limit(1);
  if (!ticket) throw new DomainError("TICKET_NOT_FOUND");
  return ticket;
}

/** Records the tare, settles the ticket and books the inventory receipt — atomically. */
export async function completeWeighingTicket(
  db: Database,
  organizationId: string,
  ticketId: string,
  input: CompleteWeighingInput,
): Promise<{ id: string; reference: string; netWeightG: number; totalAmountCts: number }> {
  assertWeight(input.tareWeightG, "tareWeight");
  if (input.unitPriceCtsPerT !== undefined) assertUnitPrice(input.unitPriceCtsPerT, "unitPrice");

  return withTransaction(db, async (tx) => {
    const ticket = await requireTicket(tx, organizationId, ticketId);
    assertTransition(ticket.status, "completed");
    const unitPriceCtsPerT = input.unitPriceCtsPerT ?? ticket.unitPriceCtsPerT;
    const candidate = { ...ticket, tareWeightG: input.tareWeightG, unitPriceCtsPerT };
    const check = checkCompletion(candidate);
    if (!check.ok) {
      const [first] = check.reasons;
      throw new DomainError(first ?? "TICKET_NOT_OPEN", {
        field:
          first === "TARE_EXCEEDS_GROSS" || first === "NET_WEIGHT_ZERO" || first === "TARE_MISSING"
            ? "tareWeight"
            : undefined,
      });
    }
    const figures = settleWeighing({
      grossWeightG: ticket.grossWeightG,
      tareWeightG: input.tareWeightG,
      unitPriceCtsPerT,
    });
    const completedAt = input.tareWeighedAt;

    await tx
      .update(weighingTickets)
      .set({
        status: "completed",
        unitPriceCtsPerT,
        tareWeightG: figures.tareWeightG,
        tareWeighedAt: input.tareWeighedAt,
        netWeightG: figures.netWeightG,
        totalAmountCts: figures.totalAmountCts,
        completedAt,
        notes: input.notes ?? ticket.notes,
      })
      .where(eq(weighingTickets.id, ticket.id));

    const receipt = receiptFromCompletedWeighing(figures);
    await tx.insert(inventoryMovements).values({
      id: randomUUID(),
      organizationId,
      yardId: ticket.yardId,
      materialId: ticket.materialId,
      weighingTicketId: ticket.id,
      ...receipt,
      occurredAt: completedAt,
      note: "",
    });

    return {
      id: ticket.id,
      reference: ticket.reference,
      netWeightG: figures.netWeightG,
      totalAmountCts: figures.totalAmountCts,
    };
  });
}

/** Cancels an open ticket. Completed tickets are immutable in V1. */
export async function cancelWeighingTicket(
  db: Database,
  organizationId: string,
  ticketId: string,
  reason: string,
): Promise<{ id: string; reference: string }> {
  return withTransaction(db, async (tx) => {
    const ticket = await requireTicket(tx, organizationId, ticketId);
    assertTransition(ticket.status, "cancelled");
    const cancelledAt = new Date();
    const notes =
      reason.trim().length > 0
        ? [ticket.notes, `Annulation : ${reason.trim()}`].filter(Boolean).join("\n")
        : ticket.notes;
    await tx
      .update(weighingTickets)
      .set({ status: "cancelled", cancelledAt, notes })
      .where(eq(weighingTickets.id, ticket.id));
    return { id: ticket.id, reference: ticket.reference };
  });
}
