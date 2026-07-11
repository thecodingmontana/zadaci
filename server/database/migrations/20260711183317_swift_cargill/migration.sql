CREATE TYPE "channel_type" AS ENUM('public', 'private', 'dm');--> statement-breakpoint
CREATE TYPE "message_reference_type" AS ENUM('task', 'project', 'file', 'link');--> statement-breakpoint
CREATE TYPE "priority" AS ENUM('low', 'medium', 'high', 'none', 'urgent');--> statement-breakpoint
CREATE TYPE "status" AS ENUM('idea', 'todo', 'in_progress', 'in_review', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('owner', 'member', 'guest');--> statement-breakpoint
CREATE TABLE "app_channel" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(255),
	"type" "channel_type" DEFAULT 'public'::"channel_type" NOT NULL,
	"created_by" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_channel_members" (
	"id" varchar(16) PRIMARY KEY,
	"channel_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"last_read_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_message" (
	"id" varchar(16) PRIMARY KEY,
	"channel_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_message_reference" (
	"id" varchar(16) PRIMARY KEY,
	"message_id" varchar(16) NOT NULL,
	"ref_type" "message_reference_type" DEFAULT 'link'::"message_reference_type" NOT NULL,
	"ref_id" varchar(16),
	"snapshot" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "cron_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_project" (
	"id" varchar(16) PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"priority" "priority" DEFAULT 'none'::"priority" NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_project_members" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_subtasks" (
	"id" varchar(16) PRIMARY KEY,
	"name" text NOT NULL,
	"task_id" varchar(16) NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_tasks" (
	"id" varchar(16) PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"priority" "priority" DEFAULT 'none'::"priority" NOT NULL,
	"project_id" varchar(16) NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_task_assignees" (
	"id" varchar(16) PRIMARY KEY,
	"task_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"assigned_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_tasks_activity" (
	"id" varchar(16) PRIMARY KEY,
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"task_id" varchar(16) NOT NULL,
	"changed_by" varchar(16) NOT NULL,
	"changed_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_oauth_account" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_passkeys" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"public_key" varchar(255) NOT NULL,
	"counter" integer NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_password_reset_session" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"expires_at" integer NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"two_factor_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_session" (
	"id" varchar(255) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
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
CREATE TABLE "app_totp_credential" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL UNIQUE,
	"key" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_unique_code_request" (
	"id" varchar(16) PRIMARY KEY,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" varchar(16) PRIMARY KEY,
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
CREATE TABLE "app_workspace" (
	"id" varchar(16) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"image_url" text NOT NULL,
	"invite_code" text NOT NULL UNIQUE,
	"user_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workspace_invite_request" (
	"id" varchar(16) PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'member'::"user_role" NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" varchar(255) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workspace_members" (
	"id" varchar(16) PRIMARY KEY,
	"role" "user_role" DEFAULT 'member'::"user_role" NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "channel_workspace_id_idx" ON "app_channel" ("workspace_id");--> statement-breakpoint
CREATE INDEX "channel_members_channel_id_idx" ON "app_channel_members" ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_members_member_id_idx" ON "app_channel_members" ("member_id");--> statement-breakpoint
CREATE INDEX "message_channel_id_idx" ON "app_message" ("channel_id");--> statement-breakpoint
CREATE INDEX "message_reference_message_id_idx" ON "app_message_reference" ("message_id");--> statement-breakpoint
CREATE INDEX "project_comment_project_id_idx" ON "app_project_comment" ("project_id");--> statement-breakpoint
CREATE INDEX "task_comment_task_id_idx" ON "app_task_comment" ("task_id");--> statement-breakpoint
CREATE INDEX "project_workspace_id_idx" ON "app_project" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "app_project_members" ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_member_id_idx" ON "app_project_members" ("member_id");--> statement-breakpoint
CREATE INDEX "subtasks_task_id_idx" ON "app_subtasks" ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "app_tasks" ("project_id");--> statement-breakpoint
CREATE INDEX "task_assignees_task_id_idx" ON "app_task_assignees" ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignees_member_id_idx" ON "app_task_assignees" ("member_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_task_id_idx" ON "app_tasks_activity" ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_changed_by_idx" ON "app_tasks_activity" ("changed_by");--> statement-breakpoint
CREATE INDEX "provider_user_unique" ON "app_oauth_account" ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "workspace_user_id_idx" ON "app_workspace" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_name_id_idx" ON "app_workspace" ("name","id");--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_id_idx" ON "app_workspace_invite_request" ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_invited_by_idx" ON "app_workspace_invite_request" ("invited_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "app_workspace_members" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "app_workspace_members" ("workspace_id");--> statement-breakpoint
ALTER TABLE "app_channel" ADD CONSTRAINT "app_channel_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_channel" ADD CONSTRAINT "app_channel_created_by_app_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_channel_members" ADD CONSTRAINT "app_channel_members_channel_id_app_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_channel_members" ADD CONSTRAINT "app_channel_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message" ADD CONSTRAINT "app_message_channel_id_app_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message" ADD CONSTRAINT "app_message_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_message_reference" ADD CONSTRAINT "app_message_reference_message_id_app_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "app_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_comment" ADD CONSTRAINT "app_project_comment_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_comment" ADD CONSTRAINT "app_project_comment_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_task_comment" ADD CONSTRAINT "app_task_comment_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_comment" ADD CONSTRAINT "app_task_comment_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_project" ADD CONSTRAINT "app_project_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_members" ADD CONSTRAINT "app_project_members_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_members" ADD CONSTRAINT "app_project_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_subtasks" ADD CONSTRAINT "app_subtasks_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD CONSTRAINT "app_tasks_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_assignees" ADD CONSTRAINT "app_task_assignees_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_assignees" ADD CONSTRAINT "app_task_assignees_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks_activity" ADD CONSTRAINT "app_tasks_activity_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks_activity" ADD CONSTRAINT "app_tasks_activity_changed_by_app_workspace_members_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_account" ADD CONSTRAINT "app_oauth_account_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_passkeys" ADD CONSTRAINT "app_passkeys_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "app_password_reset_session" ADD CONSTRAINT "app_password_reset_session_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_totp_credential" ADD CONSTRAINT "app_totp_credential_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace" ADD CONSTRAINT "app_workspace_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD CONSTRAINT "app_workspace_invite_request_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD CONSTRAINT "app_workspace_invite_request_invited_by_app_user_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace_members" ADD CONSTRAINT "app_workspace_members_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_workspace_members" ADD CONSTRAINT "app_workspace_members_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;