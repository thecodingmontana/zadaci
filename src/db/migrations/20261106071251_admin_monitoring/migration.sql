CREATE TABLE "app_error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_job_run" (
	"name" varchar(40) PRIMARY KEY,
	"at" timestamp with time zone NOT NULL,
	"ok" boolean NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE INDEX "error_log_at_idx" ON "app_error_log" ("at");--> statement-breakpoint
ALTER TABLE "app_error_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_job_run" ENABLE ROW LEVEL SECURITY;