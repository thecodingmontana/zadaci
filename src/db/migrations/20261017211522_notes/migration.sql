ALTER TABLE "app_comment" ADD COLUMN "anchor" jsonb;--> statement-breakpoint
ALTER TABLE "app_comment" ADD COLUMN "resolved_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "parent_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "sort_order" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "icon" varchar(16);--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "project_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "doc" jsonb;--> statement-breakpoint
ALTER TABLE "app_note" ADD COLUMN "updated_by" varchar(16);--> statement-breakpoint
CREATE INDEX "note_parent_id_idx" ON "app_note" ("parent_id");--> statement-breakpoint
CREATE INDEX "note_project_id_idx" ON "app_note" ("project_id");--> statement-breakpoint
ALTER TABLE "app_note" ADD CONSTRAINT "app_note_parent_id_app_note_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "app_note"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_note" ADD CONSTRAINT "app_note_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;