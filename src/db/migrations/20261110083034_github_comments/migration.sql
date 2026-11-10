CREATE TABLE "app_task_github_comment" (
	"comment_id" varchar(16) PRIMARY KEY,
	"repo" text NOT NULL,
	"github_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "task_github_comment_github" ON "app_task_github_comment" ("repo","github_id");--> statement-breakpoint
ALTER TABLE "app_task_github_comment" ADD CONSTRAINT "app_task_github_comment_comment_id_app_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "app_comment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_github_comment" ENABLE ROW LEVEL SECURITY;