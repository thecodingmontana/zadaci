CREATE TYPE "project_status" AS ENUM('planning', 'active', 'risk', 'hold', 'complete');--> statement-breakpoint
CREATE TABLE "app_project_milestone" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "key" varchar(6) DEFAULT 'PRJ' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_project" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app_project" ALTER COLUMN "status" SET DATA TYPE "project_status" USING (CASE "status"::text WHEN 'in_progress' THEN 'active' WHEN 'in_review' THEN 'active' WHEN 'completed' THEN 'complete' WHEN 'abandoned' THEN 'hold' ELSE 'planning' END)::"project_status";--> statement-breakpoint
ALTER TABLE "app_project" ALTER COLUMN "status" SET DEFAULT 'planning'::"project_status";--> statement-breakpoint
CREATE INDEX "project_milestone_project_id_idx" ON "app_project_milestone" ("project_id");--> statement-breakpoint
ALTER TABLE "app_project_milestone" ADD CONSTRAINT "app_project_milestone_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
-- existing projects: start when they were created, key from the title's letters (like the reference makeKey)
UPDATE "app_project" SET "start_date" = "created_at" WHERE "start_date" IS NULL;--> statement-breakpoint
UPDATE "app_project" SET "key" = COALESCE(NULLIF(upper(left(regexp_replace("title", '[^A-Za-z]', '', 'g'), 3)), ''), 'PRJ');
