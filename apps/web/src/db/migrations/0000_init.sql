CREATE TABLE `access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`issued_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_tokens_token_hash_unique` ON `access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `access_tokens_user_id_idx` ON `access_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text,
	`status` text DEFAULT 'running' NOT NULL,
	`config` text NOT NULL,
	`created_by` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "jobs_status_check" CHECK("jobs"."status" IN ('running', 'finished', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `jobs_project_id_idx` ON `jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `jobs_project_id_status_idx` ON `jobs` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`stream` text NOT NULL,
	`message` text NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "logs_stream_check" CHECK("logs"."stream" IN ('stdout', 'stderr'))
);
--> statement-breakpoint
CREATE INDEX `logs_job_id_idx` ON `logs` (`job_id`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`step` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_assets_kind_check" CHECK("media_assets"."kind" IN ('image', 'audio'))
);
--> statement-breakpoint
CREATE INDEX `media_assets_job_id_idx` ON `media_assets` (`job_id`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`step` integer NOT NULL,
	`key` text NOT NULL,
	`value` real NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metrics_job_id_key_step_idx` ON `metrics` (`job_id`,`key`,`step`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`visibility` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "projects_visibility_check" CHECK("projects"."visibility" IN ('public', 'private'))
);
--> statement-breakpoint
CREATE INDEX `projects_owner_id_idx` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_key` text,
	`cf_access_email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('admin', 'user'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_cf_access_email_unique` ON `users` (`cf_access_email`);