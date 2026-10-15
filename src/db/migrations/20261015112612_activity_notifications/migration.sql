CREATE TABLE "app_activity" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"actor_id" varchar(16),
	"kind" varchar(20) NOT NULL,
	"verb" varchar(64) NOT NULL,
	"target" text,
	"extra" text,
	"project_id" varchar(16),
	"task_id" varchar(16),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_notification" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"actor_id" varchar(16),
	"type" varchar(20) NOT NULL,
	"text" text NOT NULL,
	"snippet" text,
	"project_id" varchar(16),
	"task_id" varchar(16),
	"read_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_workspace_created_idx" ON "app_activity" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_workspace_idx" ON "app_notification" ("user_id","workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "app_activity" ADD CONSTRAINT "app_activity_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_activity" ADD CONSTRAINT "app_activity_actor_id_app_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_activity" ADD CONSTRAINT "app_activity_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_activity" ADD CONSTRAINT "app_activity_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_actor_id_app_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE SET NULL;