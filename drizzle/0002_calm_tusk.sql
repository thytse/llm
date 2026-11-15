CREATE TABLE `finding_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`profile_id` text NOT NULL,
	`version` integer NOT NULL,
	`kind` text NOT NULL,
	`record` text NOT NULL,
	`lifecycle` text NOT NULL,
	`predecessor` text,
	`replacement` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`profile_id` text NOT NULL,
	`version` integer NOT NULL,
	`provider` text NOT NULL,
	`state` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retrieval_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`scope` text NOT NULL,
	`result` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retrieval_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`profile_id` text NOT NULL,
	`version` integer NOT NULL,
	`message_id` text NOT NULL,
	`record` text NOT NULL,
	`embedding` text NOT NULL,
	`encoder` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`operation` text NOT NULL,
	`status` text NOT NULL,
	`record` text NOT NULL,
	`created` text NOT NULL
);
