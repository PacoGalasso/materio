/**
 * MATIÈRE relational schema (PostgreSQL dialect via Drizzle).
 *
 * Unit conventions (enforced across the whole codebase):
 * - weights are stored as INTEGER GRAMS (`*_g` columns);
 * - money is stored as INTEGER CHF CENTIMES (`*_cts` columns);
 * - unit prices are stored as INTEGER CENTIMES PER TONNE (`*_cts_per_t` columns).
 *   The `price_unit` of a material only drives input/display (CHF/kg vs CHF/t).
 * - timestamps are `timestamp with time zone`, rendered in Europe/Zurich.
 *
 * Business table ids are app-generated UUIDs (`randomUUID()`, unchanged since V1); the
 * `uuid` column type gives free format validation and compact indexes. `defaultRandom()` is
 * a safety net, not the primary id source. Auth tables (`user`, `session`, `account`,
 * `verification`) mirror Better Auth's own generated Drizzle schema exactly — their ids are
 * `text` because Better Auth generates its own id format, not necessarily a UUID.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "OPERATOR", "VIEWER"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const AUDIT_ACTIONS = [
  "WEIGHING_CREATED",
  "WEIGHING_COMPLETED",
  "WEIGHING_CANCELLED",
  "INVENTORY_ADJUSTED",
  "INVENTORY_DISPATCHED",
  "MATERIAL_CREATED",
  "MATERIAL_UPDATED",
  "MATERIAL_PRICE_CHANGED",
  "SUPPLIER_CREATED",
  "SUPPLIER_UPDATED",
  "ORGANIZATION_SETTINGS_UPDATED",
  "MEMBER_INVITED",
  "MEMBER_ROLE_CHANGED",
  "MEMBER_REMOVED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};

// --- Better Auth core tables (field names/shape must match its Drizzle adapter exactly;
// generated once via `npx @better-auth/cli generate` against this app's auth config and
// hand-merged here to keep one schema file for the whole app) -----------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Synthetic issuer namespace Better Auth uses to disambiguate providers, e.g.
     * "local:credential" — see `createLocalAccountIssuer` from "better-auth/db". */
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Login/API abuse throttling, persisted here (not in-process memory) so the limit holds
 * even if the app is ever run as more than one instance. See src/server/auth.ts. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// --- Business tables -----------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
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

/** Membership is the sole source of role/tenancy truth: which users belong to which
 * organization, and what they're allowed to do there. Never trust a client-supplied role. */
export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: MEMBERSHIP_ROLES }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("organization_memberships_org_user_idx").on(t.organizationId, t.userId),
    index("organization_memberships_user_idx").on(t.userId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Null only for the rare system-triggered event; every user action populates it. */
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** Safe, non-sensitive context only: never passwords, tokens, cookies or headers. */
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_events_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_events_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const yards = pgTable(
  "yards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("yards_org_code_idx").on(t.organizationId, t.code)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
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
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("suppliers_org_name_idx").on(t.organizationId, t.name)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
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

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: MATERIAL_CATEGORIES }).notNull(),
    /** Display/input preference only. Storage is always centimes per tonne. */
    priceUnit: text("price_unit", { enum: PRICE_UNITS }).notNull().default("kg"),
    currentPurchasePriceCtsPerT: integer("current_purchase_price_cts_per_t").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("materials_org_code_idx").on(t.organizationId, t.code),
    check("materials_price_non_negative", sql`${t.currentPurchasePriceCtsPerT} >= 0`),
  ],
);

export const materialPrices = pgTable(
  "material_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Denormalized alongside materialId so every business table stays directly tenant-scoped. */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    purchasePriceCtsPerT: integer("purchase_price_cts_per_t").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: "date" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("material_prices_material_effective_idx").on(t.materialId, t.effectiveFrom),
    index("material_prices_org_idx").on(t.organizationId),
    check("material_prices_non_negative", sql`${t.purchasePriceCtsPerT} >= 0`),
  ],
);

export const weighingTickets = pgTable(
  "weighing_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    yardId: uuid("yard_id")
      .notNull()
      .references(() => yards.id),
    reference: text("reference").notNull(),
    status: text("status", { enum: WEIGHING_STATUSES }).notNull().default("open"),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    plateSnapshot: text("plate_snapshot").notNull(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    unitPriceCtsPerT: integer("unit_price_cts_per_t").notNull(),
    grossWeightG: integer("gross_weight_g").notNull(),
    grossWeighedAt: timestamp("gross_weighed_at", { withTimezone: true, mode: "date" }).notNull(),
    tareWeightG: integer("tare_weight_g"),
    tareWeighedAt: timestamp("tare_weighed_at", { withTimezone: true, mode: "date" }),
    netWeightG: integer("net_weight_g"),
    totalAmountCts: integer("total_amount_cts"),
    externalReference: text("external_reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
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

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    yardId: uuid("yard_id")
      .notNull()
      .references(() => yards.id),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    weighingTicketId: uuid("weighing_ticket_id").references(() => weighingTickets.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
    /** Signed quantity in grams: positive enters the yard, negative leaves it. */
    quantityG: integer("quantity_g").notNull(),
    /** Valuation basis of the movement, centimes per tonne. */
    unitValueCtsPerT: integer("unit_value_cts_per_t").notNull(),
    /** Signed amount in centimes (same sign as quantity). */
    amountCts: integer("amount_cts").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex("inventory_movements_ticket_idx").on(t.weighingTicketId),
    index("inventory_movements_material_occurred_idx").on(t.materialId, t.occurredAt),
    index("inventory_movements_org_occurred_idx").on(t.organizationId, t.occurredAt),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(organizationMemberships),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationMembershipRelations = relations(organizationMemberships, ({ one }) => ({
  user: one(user, { fields: [organizationMemberships.userId], references: [user.id] }),
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
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
export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
