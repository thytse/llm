CREATE TABLE `profile_batch_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`profile_id` text NOT NULL,
	`record` text NOT NULL,
	`created` text NOT NULL
);
