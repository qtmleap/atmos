CREATE TABLE "access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text,
	"issued_at" timestamptz(0) NOT NULL,
	"revoked_at" timestamptz(0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'running' NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"started_at" timestamptz(0) NOT NULL,
	"finished_at" timestamptz(0),
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('running', 'finished', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" text NOT NULL,
	"stream" text NOT NULL,
	"message" text NOT NULL,
	"logged_at" timestamptz(0) NOT NULL,
	CONSTRAINT "logs_stream_check" CHECK ("logs"."stream" IN ('stdout', 'stderr'))
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"step" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"r2_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"logged_at" timestamptz(0) NOT NULL,
	CONSTRAINT "media_assets_kind_check" CHECK ("media_assets"."kind" IN ('image', 'audio'))
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" text NOT NULL,
	"step" integer NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"logged_at" timestamptz(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamptz(0) NOT NULL,
	CONSTRAINT "projects_visibility_check" CHECK ("projects"."visibility" IN ('public', 'internal', 'private'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_key" text,
	"cf_access_email" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamptz(0) NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('admin', 'user'))
);
--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_tokens_token_hash_unique" ON "access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "access_tokens_user_id_idx" ON "access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_project_id_idx" ON "jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "jobs_project_id_status_idx" ON "jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "logs_job_id_idx" ON "logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "media_assets_job_id_idx" ON "media_assets" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "metrics_job_id_key_step_idx" ON "metrics" USING btree ("job_id","key","step");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_unique" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "users_cf_access_email_unique" ON "users" USING btree ("cf_access_email");