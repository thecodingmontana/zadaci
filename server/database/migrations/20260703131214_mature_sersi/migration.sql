CREATE TYPE "priority" AS ENUM('low', 'medium', 'high', 'none', 'urgent');--> statement-breakpoint
CREATE TYPE "status" AS ENUM('idea', 'todo', 'in_progress', 'in_review', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('owner', 'member', 'guest');--> statement-breakpoint
CREATE TABLE "oauth_account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_session" (
	"id" varchar(255) PRIMARY KEY,
	"user_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"expires_at" integer NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"ip_address" varchar(100),
	"location" text,
	"device" text,
	"browser" text,
	"os" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_credential" (
	"id" varchar(255) PRIMARY KEY,
	"user_id" text NOT NULL UNIQUE,
	"key" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_code_request" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"email" varchar(255) NOT NULL UNIQUE,
	"username" varchar(255) NOT NULL,
	"password" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"registered_2fa" boolean DEFAULT false NOT NULL,
	"recovery_code" text NOT NULL,
	"profile_picture_url" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"image_url" text NOT NULL,
	"invite_code" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_request" (
	"id" varchar(255) PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'member'::"user_role" NOT NULL,
	"workspace_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY,
	"role" "user_role" DEFAULT 'member'::"user_role" NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"priority" "priority" DEFAULT 'none'::"priority" NOT NULL,
	"workspace_id" text NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"task_id" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"priority" "priority" DEFAULT 'none'::"priority" NOT NULL,
	"project_id" text NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"id" text PRIMARY KEY,
	"task_id" text NOT NULL,
	"member_id" text NOT NULL,
	"assigned_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_activity" (
	"id" text PRIMARY KEY,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"task_id" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "provider_user_unique" ON "oauth_account" ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "workspace_user_id_idx" ON "workspace" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_name_id_idx" ON "workspace" ("name","id");--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_id_idx" ON "workspace_invite_request" ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_invited_by_idx" ON "workspace_invite_request" ("invited_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_workspace_id_idx" ON "project" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "project_members" ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_member_id_idx" ON "project_members" ("member_id");--> statement-breakpoint
CREATE INDEX "subtasks_task_id_idx" ON "subtasks" ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" ("project_id");--> statement-breakpoint
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees" ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignees_member_id_idx" ON "task_assignees" ("member_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_task_id_idx" ON "tasks_activity" ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_changed_by_idx" ON "tasks_activity" ("changed_by");--> statement-breakpoint
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "password_reset_session" ADD CONSTRAINT "password_reset_session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "totp_credential" ADD CONSTRAINT "totp_credential_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "workspace_invite_request" ADD CONSTRAINT "workspace_invite_request_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_invite_request" ADD CONSTRAINT "workspace_invite_request_invited_by_user_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_member_id_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_member_id_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks_activity" ADD CONSTRAINT "tasks_activity_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks_activity" ADD CONSTRAINT "tasks_activity_changed_by_workspace_members_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "workspace_members"("id") ON DELETE CASCADE;