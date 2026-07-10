CREATE TYPE "channel_type" AS ENUM('public', 'private', 'dm');--> statement-breakpoint
CREATE TYPE "message_reference_type" AS ENUM('task', 'project', 'file', 'link');--> statement-breakpoint
CREATE TABLE "app_project_comment" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_task_comment" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "deleted_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_subtasks" ADD COLUMN "deleted_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "deleted_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_task_assignees" ADD COLUMN "deleted_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_tasks_activity" ADD COLUMN "deleted_at" timestamp(3) with time zone;--> statement-breakpoint
CREATE INDEX "project_comment_project_id_idx" ON "app_project_comment" ("project_id");--> statement-breakpoint
CREATE INDEX "task_comment_task_id_idx" ON "app_task_comment" ("task_id");--> statement-breakpoint
ALTER TABLE "app_project_comment" ADD CONSTRAINT "app_project_comment_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_comment" ADD CONSTRAINT "app_project_comment_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_task_comment" ADD CONSTRAINT "app_task_comment_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_comment" ADD CONSTRAINT "app_task_comment_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");