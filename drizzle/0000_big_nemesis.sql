CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"yard_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"weighing_ticket_id" uuid,
	"type" text NOT NULL,
	"quantity_g" integer NOT NULL,
	"unit_value_cts_per_t" integer NOT NULL,
	"amount_cts" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"purchase_price_cts_per_t" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_prices_non_negative" CHECK ("material_prices"."purchase_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_unit" text DEFAULT 'kg' NOT NULL,
	"current_purchase_price_cts_per_t" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_price_non_negative" CHECK ("materials"."current_purchase_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"canton" text DEFAULT '' NOT NULL,
	"vat_number" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"weight_unit" text DEFAULT 'kg' NOT NULL,
	"locale" text DEFAULT 'fr-CH' NOT NULL,
	"timezone" text DEFAULT 'Europe/Zurich' NOT NULL,
	"ticket_prefix" text DEFAULT 'P' NOT NULL,
	"next_ticket_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"canton" text DEFAULT '' NOT NULL,
	"vat_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid,
	"plate" text NOT NULL,
	"plate_display" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weighing_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"yard_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"supplier_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"plate_snapshot" text NOT NULL,
	"material_id" uuid NOT NULL,
	"unit_price_cts_per_t" integer NOT NULL,
	"gross_weight_g" integer NOT NULL,
	"gross_weighed_at" timestamp with time zone NOT NULL,
	"tare_weight_g" integer,
	"tare_weighed_at" timestamp with time zone,
	"net_weight_g" integer,
	"total_amount_cts" integer,
	"external_reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weighing_tickets_gross_non_negative" CHECK ("weighing_tickets"."gross_weight_g" >= 0),
	CONSTRAINT "weighing_tickets_tare_non_negative" CHECK ("weighing_tickets"."tare_weight_g" IS NULL OR "weighing_tickets"."tare_weight_g" >= 0),
	CONSTRAINT "weighing_tickets_price_non_negative" CHECK ("weighing_tickets"."unit_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE TABLE "yards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_weighing_ticket_id_weighing_tickets_id_fk" FOREIGN KEY ("weighing_ticket_id") REFERENCES "public"."weighing_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing_tickets" ADD CONSTRAINT "weighing_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing_tickets" ADD CONSTRAINT "weighing_tickets_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing_tickets" ADD CONSTRAINT "weighing_tickets_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing_tickets" ADD CONSTRAINT "weighing_tickets_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weighing_tickets" ADD CONSTRAINT "weighing_tickets_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yards" ADD CONSTRAINT "yards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_ticket_idx" ON "inventory_movements" USING btree ("weighing_ticket_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_material_occurred_idx" ON "inventory_movements" USING btree ("material_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_org_occurred_idx" ON "inventory_movements" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "material_prices_material_effective_idx" ON "material_prices" USING btree ("material_id","effective_from");--> statement-breakpoint
CREATE INDEX "material_prices_org_idx" ON "material_prices" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_org_code_idx" ON "materials" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_idx" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_name_idx" ON "suppliers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_org_plate_idx" ON "vehicles" USING btree ("organization_id","plate");--> statement-breakpoint
CREATE INDEX "vehicles_supplier_idx" ON "vehicles" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "weighing_tickets_reference_idx" ON "weighing_tickets" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "weighing_tickets_org_status_idx" ON "weighing_tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "weighing_tickets_org_weighed_idx" ON "weighing_tickets" USING btree ("organization_id","gross_weighed_at");--> statement-breakpoint
CREATE INDEX "weighing_tickets_supplier_idx" ON "weighing_tickets" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "weighing_tickets_material_idx" ON "weighing_tickets" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "yards_org_code_idx" ON "yards" USING btree ("organization_id","code");