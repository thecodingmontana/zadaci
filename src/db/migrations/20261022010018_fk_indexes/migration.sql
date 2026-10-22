CREATE INDEX "activity_actor_id_idx" ON "app_activity" ("actor_id");--> statement-breakpoint
CREATE INDEX "notification_actor_id_idx" ON "app_notification" ("actor_id");--> statement-breakpoint
CREATE INDEX "notification_task_id_idx" ON "app_notification" ("task_id");--> statement-breakpoint
CREATE INDEX "notification_project_id_idx" ON "app_notification" ("project_id");--> statement-breakpoint
CREATE INDEX "bookmark_collection_project_id_idx" ON "app_bookmark_collection" ("project_id");