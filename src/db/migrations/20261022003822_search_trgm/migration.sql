-- search uses ilike '%q%'; trigram GIN indexes make that fast
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "bookmark_title_trgm_idx" ON "app_bookmark" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "comment_content_trgm_idx" ON "app_comment" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "note_title_trgm_idx" ON "app_note" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "note_content_trgm_idx" ON "app_note" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tasks_name_trgm_idx" ON "app_tasks" USING gin ("name" gin_trgm_ops);