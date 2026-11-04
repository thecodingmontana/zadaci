CREATE TABLE "app_task_github_issue" (
	"task_id" varchar(16) PRIMARY KEY,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"synced_hash" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "task_github_issue_repo_number" ON "app_task_github_issue" ("repo","number");--> statement-breakpoint
ALTER TABLE "app_task_github_issue" ADD CONSTRAINT "app_task_github_issue_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_github_issue" ENABLE ROW LEVEL SECURITY;
