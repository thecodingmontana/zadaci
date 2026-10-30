CREATE TABLE "app_project_github" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"repo" text NOT NULL,
	"nonce" text NOT NULL,
	"connected_by" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_task_github_pr" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"state" varchar(10) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_project_unique" ON "app_project_github" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_github_pr_unique" ON "app_task_github_pr" ("task_id","repo","number");--> statement-breakpoint
CREATE INDEX "task_github_pr_task_idx" ON "app_task_github_pr" ("task_id");--> statement-breakpoint
ALTER TABLE "app_project_github" ADD CONSTRAINT "app_project_github_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_github" ADD CONSTRAINT "app_project_github_connected_by_app_user_id_fkey" FOREIGN KEY ("connected_by") REFERENCES "app_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_task_github_pr" ADD CONSTRAINT "app_task_github_pr_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;