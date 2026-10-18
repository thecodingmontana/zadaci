CREATE INDEX "activity_task_created_idx" ON "app_activity" ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_project_created_idx" ON "app_activity" ("project_id","created_at");