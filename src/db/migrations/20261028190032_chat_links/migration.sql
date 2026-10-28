ALTER TABLE "app_chat_channel" ADD COLUMN "project_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD COLUMN "task_id" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_channel_general_unique" ON "app_chat_channel" ("workspace_id") WHERE kind = 'channel' and name = 'general';--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD CONSTRAINT "app_chat_channel_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD CONSTRAINT "app_chat_channel_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE SET NULL;