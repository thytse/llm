ALTER TABLE `profiles` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `summary_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `summary_error` text;