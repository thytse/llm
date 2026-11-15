CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`profile_id` text NOT NULL,
	`source_id` text NOT NULL,
	`speaker` text NOT NULL,
	`timestamp` text NOT NULL,
	`body` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`relationship` text NOT NULL,
	`context` text NOT NULL,
	`created` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`owner` text NOT NULL,
	`filename` text NOT NULL,
	`hash` text NOT NULL,
	`raw` text NOT NULL,
	`created` text NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`room` text NOT NULL,
	`scope` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`created` text NOT NULL,
	`kind` text NOT NULL
);
