ALTER TABLE "app_project_github" ADD COLUMN "board" jsonb;--> statement-breakpoint
ALTER TABLE "app_project_github" ADD COLUMN "board_error" text;--> statement-breakpoint
ALTER TABLE "app_task_github_issue" ADD COLUMN "card" text;--> statement-breakpoint
ALTER TABLE "app_task_github_issue" ADD COLUMN "card_status" text;