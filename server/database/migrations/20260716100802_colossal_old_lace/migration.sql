CREATE TYPE "user_status" AS ENUM('available', 'busy', 'away', 'dnd', 'offline');--> statement-breakpoint
CREATE TABLE "app_project_tags" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"tag_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_tag" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_task_tags" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"tag_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_team" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(20),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_team_members" (
	"id" varchar(16) PRIMARY KEY,
	"team_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user_status" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL UNIQUE,
	"status" "user_status" DEFAULT 'available'::"user_status" NOT NULL,
	"custom_message" text,
	"status_expires_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "team_id" varchar(16);--> statement-breakpoint
CREATE INDEX "project_team_id_idx" ON "app_project" ("team_id");--> statement-breakpoint
CREATE INDEX "project_tags_project_id_idx" ON "app_project_tags" ("project_id");--> statement-breakpoint
CREATE INDEX "project_tags_tag_id_idx" ON "app_project_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "tag_workspace_id_idx" ON "app_tag" ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_tags_task_id_idx" ON "app_task_tags" ("task_id");--> statement-breakpoint
CREATE INDEX "task_tags_tag_id_idx" ON "app_task_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "team_workspace_id_idx" ON "app_team" ("workspace_id");--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "app_team_members" ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_member_id_idx" ON "app_team_members" ("member_id");--> statement-breakpoint
ALTER TABLE "app_project" ADD CONSTRAINT "app_project_team_id_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app_team"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_project_tags" ADD CONSTRAINT "app_project_tags_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_tags" ADD CONSTRAINT "app_project_tags_tag_id_app_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "app_tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tag" ADD CONSTRAINT "app_tag_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_tags" ADD CONSTRAINT "app_task_tags_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_tags" ADD CONSTRAINT "app_task_tags_tag_id_app_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "app_tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team" ADD CONSTRAINT "app_team_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team_members" ADD CONSTRAINT "app_team_members_team_id_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app_team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team_members" ADD CONSTRAINT "app_team_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_user_status" ADD CONSTRAINT "app_user_status_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;