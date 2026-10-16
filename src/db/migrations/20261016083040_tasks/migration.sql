CREATE TABLE "app_saved_view" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"filters" jsonb DEFAULT '[]' NOT NULL,
	"created_by" varchar(16),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_task_attachment" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"mime" varchar(120),
	"size" integer DEFAULT 0 NOT NULL,
	"uploaded_by" varchar(16),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_task_dependency" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"depends_on_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_comment" ADD COLUMN "reactions" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "task_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "sort_order" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "labels" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "estimate" varchar(20);--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "recur" varchar(20);--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "saved_view_project_id_idx" ON "app_saved_view" ("project_id");--> statement-breakpoint
CREATE INDEX "task_attachment_task_id_idx" ON "app_task_attachment" ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependency_pair_idx" ON "app_task_dependency" ("task_id","depends_on_id");--> statement-breakpoint
CREATE INDEX "task_dependency_depends_on_idx" ON "app_task_dependency" ("depends_on_id");--> statement-breakpoint
ALTER TABLE "app_saved_view" ADD CONSTRAINT "app_saved_view_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_saved_view" ADD CONSTRAINT "app_saved_view_created_by_app_workspace_members_id_fkey" FOREIGN KEY ("created_by") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_task_attachment" ADD CONSTRAINT "app_task_attachment_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_attachment" ADD CONSTRAINT "app_task_attachment_uploaded_by_app_workspace_members_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_task_dependency" ADD CONSTRAINT "app_task_dependency_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_dependency" ADD CONSTRAINT "app_task_dependency_depends_on_id_app_tasks_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
-- existing tasks: number them per project in creation order, keep that order, and date completions
UPDATE "app_tasks" t SET "number" = n.rn, "sort_order" = n.rn FROM (SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY "created_at", "id") AS rn FROM "app_tasks") n WHERE t."id" = n."id";--> statement-breakpoint
UPDATE "app_tasks" SET "completed_at" = "updated_at" WHERE "status" = 'completed' AND "completed_at" IS NULL;--> statement-breakpoint
UPDATE "app_project" p SET "task_seq" = COALESCE((SELECT max("number") FROM "app_tasks" WHERE "project_id" = p."id"), 0);
