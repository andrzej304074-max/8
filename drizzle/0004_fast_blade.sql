CREATE TABLE `rule_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`effect` text NOT NULL,
	`detail` text,
	`executed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rule_exec_rule_listing` ON `rule_executions` (`rule_id`,`listing_id`);