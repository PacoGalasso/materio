CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`yard_id` text NOT NULL,
	`material_id` text NOT NULL,
	`weighing_ticket_id` text,
	`type` text NOT NULL,
	`quantity_g` integer NOT NULL,
	`unit_value_cts_per_t` integer NOT NULL,
	`amount_cts` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`yard_id`) REFERENCES `yards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weighing_ticket_id`) REFERENCES `weighing_tickets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_movements_ticket_idx` ON `inventory_movements` (`weighing_ticket_id`);--> statement-breakpoint
CREATE INDEX `inventory_movements_material_occurred_idx` ON `inventory_movements` (`material_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `inventory_movements_org_occurred_idx` ON `inventory_movements` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `material_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`purchase_price_cts_per_t` integer NOT NULL,
	`effective_from` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "material_prices_non_negative" CHECK("material_prices"."purchase_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE INDEX `material_prices_material_effective_idx` ON `material_prices` (`material_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price_unit` text DEFAULT 'kg' NOT NULL,
	`current_purchase_price_cts_per_t` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "materials_price_non_negative" CHECK("materials"."current_purchase_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_org_code_idx` ON `materials` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`canton` text DEFAULT '' NOT NULL,
	`vat_number` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`locale` text DEFAULT 'fr-CH' NOT NULL,
	`timezone` text DEFAULT 'Europe/Zurich' NOT NULL,
	`ticket_prefix` text DEFAULT 'P' NOT NULL,
	`next_ticket_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`canton` text DEFAULT '' NOT NULL,
	`vat_number` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `suppliers_org_name_idx` ON `suppliers` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`supplier_id` text,
	`plate` text NOT NULL,
	`plate_display` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_org_plate_idx` ON `vehicles` (`organization_id`,`plate`);--> statement-breakpoint
CREATE INDEX `vehicles_supplier_idx` ON `vehicles` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `weighing_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`yard_id` text NOT NULL,
	`reference` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`supplier_id` text NOT NULL,
	`vehicle_id` text,
	`plate_snapshot` text NOT NULL,
	`material_id` text NOT NULL,
	`unit_price_cts_per_t` integer NOT NULL,
	`gross_weight_g` integer NOT NULL,
	`gross_weighed_at` integer NOT NULL,
	`tare_weight_g` integer,
	`tare_weighed_at` integer,
	`net_weight_g` integer,
	`total_amount_cts` integer,
	`external_reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`completed_at` integer,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`yard_id`) REFERENCES `yards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "weighing_tickets_gross_non_negative" CHECK("weighing_tickets"."gross_weight_g" >= 0),
	CONSTRAINT "weighing_tickets_tare_non_negative" CHECK("weighing_tickets"."tare_weight_g" IS NULL OR "weighing_tickets"."tare_weight_g" >= 0),
	CONSTRAINT "weighing_tickets_price_non_negative" CHECK("weighing_tickets"."unit_price_cts_per_t" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weighing_tickets_reference_idx` ON `weighing_tickets` (`organization_id`,`reference`);--> statement-breakpoint
CREATE INDEX `weighing_tickets_org_status_idx` ON `weighing_tickets` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `weighing_tickets_org_weighed_idx` ON `weighing_tickets` (`organization_id`,`gross_weighed_at`);--> statement-breakpoint
CREATE INDEX `weighing_tickets_supplier_idx` ON `weighing_tickets` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `weighing_tickets_material_idx` ON `weighing_tickets` (`material_id`);--> statement-breakpoint
CREATE TABLE `yards` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yards_org_code_idx` ON `yards` (`organization_id`,`code`);