ALTER TABLE `jobs` ADD `last_activity_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `jobs` SET `last_activity_at` = unixepoch();