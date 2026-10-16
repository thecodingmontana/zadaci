ALTER TABLE "app_task_attachment" ADD COLUMN "project_id" varchar(16);--> statement-breakpoint
UPDATE "app_task_attachment" a SET "project_id" = t."project_id" FROM "app_tasks" t WHERE t."id" = a."task_id";--> statement-breakpoint
ALTER TABLE "app_task_attachment" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_task_attachment" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "task_attachment_project_id_idx" ON "app_task_attachment" ("project_id");--> statement-breakpoint
ALTER TABLE "app_task_attachment" ADD CONSTRAINT "app_task_attachment_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;