CREATE TABLE "app_github_account" (
	"user_id" varchar(16) PRIMARY KEY,
	"login" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_github_account" ADD CONSTRAINT "app_github_account_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_github_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_project_github" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_task_github_pr" ENABLE ROW LEVEL SECURITY;
