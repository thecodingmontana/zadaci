ALTER TABLE "app_project_github" ADD COLUMN "sync_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_task_github_issue" ALTER COLUMN "number" DROP NOT NULL;