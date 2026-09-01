/**
 * MATIÈRE relational schema (SQLite dialect via Drizzle).
 *
 * Unit conventions (enforced across the whole codebase):
 * - weights are stored as INTEGER GRAMS (`*_g` columns);
 * - money is stored as INTEGER CHF CENTIMES (`*_cts` columns);
 * - unit prices are stored as INTEGER CENTIMES PER TONNE (`*_cts_per_t` columns).
 *   The `price_unit` of a material only drives input/display (CHF/kg vs CHF/t).
 * - timestamps are stored as epoch milliseconds (UTC) and rendered in Europe/Zurich.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const MATERIAL_CATEGORIES = [
  "non_ferrous",
  "ferrous",
  "stainless",
  "cables",
  "other",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const PRICE_UNITS = ["kg", "t"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const WEIGHING_STATUSES = ["open", "completed", "cancelled"] as const;
export type WeighingStatus = (typeof WEIGHING_STATUSES)[number];

export const MOVEMENT_TYPES = ["receipt", "dispatch", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  canton: text("canton").notNull().default(""),
  vatNumber: text("vat_number").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  currency: text("currency").notNull().default("CHF"),
  weightUnit: text("weight_unit", { enum: ["kg"] })
    .notNull()
    .default("kg"),
  locale: text("locale").notNull().default("fr-CH"),
  timezone: text("timezone").notNull().default("Europe/Zurich"),
  ticketPrefix: text("ticket_prefix").notNull().default("P"),
  nextTicketNumber: integer("next_ticket_number").notNull().default(1),
  ...timestamps,
});

export const yards = sqliteTable(
  "yards",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("yards_org_code_idx").on(t.organizationId, t.code)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    street: text("street").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    city: text("city").notNull().default(""),
    canton: text("canton").notNull().default(""),
    vatNumber: text("vat_number").notNull().default(""),
    notes: text("notes").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index("suppliers_org_name_idx").on(t.organizationId, t.name)],
);

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    /** Normalized plate: uppercase, no spaces or separators (used for uniqueness and search). */
    plate: text("plate").notNull(),
    /** Plate as displayed, e.g. "VD 123 456". */
    plateDisplay: text("plate_display").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("vehicles_org_plate_idx").on(t.organizationId, t.plate),
    index("vehicles_supplier_idx").on(t.supplierId),
  ],
);

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: MATERIAL_CATEGORIES }).notNull(),
    /** Display/input preference only. Storage is always centimes per tonne. */
    priceUnit: text("price_unit", { enum: PRICE_UNITS }).notNull().default("kg"),
    currentPurchasePriceCtsPerT: integer("current_purchase_price_cts_per_t").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("materials_org_code_idx").on(t.organizationId, t.code),
    check("materials_price_non_negative", sql`${t.currentPurchasePriceCtsPerT} >= 0`),
  ],
);

export const materialPrices = sqliteTable(
  "material_prices",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    purchasePriceCtsPerT: integer("purchase_price_cts_per_t").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp_ms" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("material_prices_material_effective_idx").on(t.materialId, t.effectiveFrom),
    check("material_prices_non_negative", sql`${t.purchasePriceCtsPerT} >= 0`),
  ],
);

export const weighingTickets = sqliteTable(
  "weighing_tickets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    yardId: text("yard_id")
      .notNull()
      .references(() => yards.id),
    reference: text("reference").notNull(),
    status: text("status", { enum: WEIGHING_STATUSES }).notNull().default("open"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    plateSnapshot: text("plate_snapshot").notNull(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    unitPriceCtsPerT: integer("unit_price_cts_per_t").notNull(),
    grossWeightG: integer("gross_weight_g").notNull(),
    grossWeighedAt: integer("gross_weighed_at", { mode: "timestamp_ms" }).notNull(),
    tareWeightG: integer("tare_weight_g"),
    tareWeighedAt: integer("tare_weighed_at", { mode: "timestamp_ms" }),
    netWeightG: integer("net_weight_g"),
    totalAmountCts: integer("total_amount_cts"),
    externalReference: text("external_reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("weighing_tickets_reference_idx").on(t.organizationId, t.reference),
    index("weighing_tickets_org_status_idx").on(t.organizationId, t.status),
    index("weighing_tickets_org_weighed_idx").on(t.organizationId, t.grossWeighedAt),
    index("weighing_tickets_supplier_idx").on(t.supplierId),
    index("weighing_tickets_material_idx").on(t.materialId),
    check("weighing_tickets_gross_non_negative", sql`${t.grossWeightG} >= 0`),
    check(
      "weighing_tickets_tare_non_negative",
      sql`${t.tareWeightG} IS NULL OR ${t.tareWeightG} >= 0`,
    ),
    check("weighing_tickets_price_non_negative", sql`${t.unitPriceCtsPerT} >= 0`),
  ],
);

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    yardId: text("yard_id")
      .notNull()
      .references(() => yards.id),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    weighingTicketId: text("weighing_ticket_id").references(() => weighingTickets.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
    /** Signed quantity in grams: positive enters the yard, negative leaves it. */
    quantityG: integer("quantity_g").notNull(),
    /** Valuation basis of the movement, centimes per tonne. */
    unitValueCtsPerT: integer("unit_value_cts_per_t").notNull(),
    /** Signed amount in centimes (same sign as quantity). */
    amountCts: integer("amount_cts").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex("inventory_movements_ticket_idx").on(t.weighingTicketId),
    index("inventory_movements_material_occurred_idx").on(t.materialId, t.occurredAt),
    index("inventory_movements_org_occurred_idx").on(t.organizationId, t.occurredAt),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type Yard = typeof yards.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type MaterialPrice = typeof materialPrices.$inferSelect;
export type WeighingTicket = typeof weighingTickets.$inferSelect;
export type NewWeighingTicket = typeof weighingTickets.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
