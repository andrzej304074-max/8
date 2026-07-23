CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`platform` text DEFAULT 'vinted' NOT NULL,
	`session_status` text DEFAULT 'manual' NOT NULL,
	`secret_ref` text,
	`active_listing_limit` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_cache` (
	`photo_set_hash` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	`account` text,
	`action` text NOT NULL,
	`payload` text,
	`outcome` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `idx_event_log_created` ON `event_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_event_log_account_created` ON `event_log` (`account`,`created_at`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`category` text,
	`size` text,
	`condition` text,
	`color` text,
	`material` text,
	`purchase_price_gr` integer,
	`expected_price_gr` integer,
	`shipping_cost_gr` integer,
	`location` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_status` ON `items` (`status`);--> statement-breakpoint
CREATE INDEX `idx_items_created_at` ON `items` (`created_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`idempotency_key` text NOT NULL,
	`item_id` integer,
	`account_id` integer,
	`rule_id` integer,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_status_scheduled` ON `jobs` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jobs_idempotency_key` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`platform` text DEFAULT 'vinted' NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`description` text,
	`price_gr` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`refreshed_at` text,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`created_via` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_listings_item` ON `listings` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_listings_account_status` ON `listings` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`original_key` text NOT NULL,
	`processed_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_item_position` ON `photos` (`item_id`,`position`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`conditions` text NOT NULL,
	`actions` text NOT NULL,
	`max_executions` integer,
	`executions_count` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`final_price_gr` integer NOT NULL,
	`commission_gr` integer DEFAULT 0 NOT NULL,
	`shipping_gr` integer DEFAULT 0 NOT NULL,
	`margin_gr` integer,
	`sold_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sales_sold_at` ON `sales` (`sold_at`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`ref` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`footer` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
