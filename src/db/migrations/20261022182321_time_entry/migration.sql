CREATE TABLE "app_time_entry" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "time_entry_task_idx" ON "app_time_entry" ("task_id");--> statement-breakpoint
CREATE INDEX "time_entry_member_idx" ON "app_time_entry" ("member_id","ended_at");--> statement-breakpoint
ALTER TABLE "app_time_entry" ADD CONSTRAINT "app_time_entry_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_time_entry" ADD CONSTRAINT "app_time_entry_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;