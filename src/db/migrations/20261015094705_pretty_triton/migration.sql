CREATE TYPE "channel_type" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "priority" AS ENUM('low', 'medium', 'high', 'none', 'urgent');--> statement-breakpoint
CREATE TYPE "status" AS ENUM('idea', 'todo', 'in_progress', 'in_review', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "user_status" AS ENUM('available', 'busy', 'away', 'dnd', 'offline');--> statement-breakpoint
CREATE TABLE "app_channel" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
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
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_message" (
	"id" varchar(16) PRIMARY KEY,
	"channel_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp(3) with time zone,
	"reactions" jsonb DEFAULT '[]' NOT NULL,
	"parent_message_id" varchar(16),
	"thread_reply_count" integer DEFAULT 0 NOT NULL,
	"thread_participant_ids" jsonb DEFAULT '[]' NOT NULL,
	"thread_last_reply_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_message_receipt" (
	"id" varchar(16) PRIMARY KEY,
	"message_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"status" varchar(20) DEFAULT 'delivered' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_message_reference" (
	"id" varchar(16) PRIMARY KEY,
	"message_id" varchar(16) NOT NULL,
	"ref_type" varchar(20) DEFAULT 'link' NOT NULL,
	"ref_id" varchar(16),
	"snapshot" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_comment" (
	"id" varchar(16) PRIMARY KEY,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"parent_id" varchar(16),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_conversation" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"member_one_id" varchar(16) NOT NULL,
	"member_two_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_direct_message" (
	"id" varchar(16) PRIMARY KEY,
	"conversation_id" varchar(16) NOT NULL,
	"author_id" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp(3) with time zone,
	"reactions" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_direct_message_receipt" (
	"id" varchar(16) PRIMARY KEY,
	"direct_message_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"status" varchar(20) DEFAULT 'delivered' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_favorite" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_feedback" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"type" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_note" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"created_by" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_project" (
	"id" varchar(16) PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"icon" varchar(60),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"color" varchar(20),
	"status" "status" DEFAULT 'idea'::"status" NOT NULL,
	"priority" "priority" DEFAULT 'none'::"priority" NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"team_id" varchar(16),
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
	"parent_task_id" varchar(16),
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
CREATE TABLE "app_project_tags" (
	"id" varchar(16) PRIMARY KEY,
	"project_id" varchar(16) NOT NULL,
	"tag_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
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
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_team" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(20),
	"icon" varchar(60),
	"description" text,
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
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_passkey" (
	"id" text PRIMARY KEY,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"user_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_two_factor" (
	"id" text PRIMARY KEY,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" varchar(16) PRIMARY KEY,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"whats_new_last_seen_version" varchar(20),
	"preferences" jsonb DEFAULT '{}' NOT NULL,
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
CREATE TABLE "app_verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workspace" (
	"id" varchar(16) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"slug" varchar(48) NOT NULL UNIQUE,
	"image_url" text,
	"invite_code" text NOT NULL UNIQUE,
	"use_case" varchar(20),
	"team_size" varchar(10),
	"default_view" varchar(10) DEFAULT 'board' NOT NULL,
	"color" varchar(20),
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
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
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_workspace_members" (
	"id" varchar(16) PRIMARY KEY,
	"role" "user_role" DEFAULT 'member'::"user_role" NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "channel_workspace_id_idx" ON "app_channel" ("workspace_id");--> statement-breakpoint
CREATE INDEX "channel_members_channel_id_idx" ON "app_channel_members" ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_members_member_id_idx" ON "app_channel_members" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_members_channel_member_unique" ON "app_channel_members" ("channel_id","member_id");--> statement-breakpoint
CREATE INDEX "message_channel_id_idx" ON "app_message" ("channel_id");--> statement-breakpoint
CREATE INDEX "message_parent_message_id_idx" ON "app_message" ("parent_message_id");--> statement-breakpoint
CREATE INDEX "message_thread_last_reply_at_idx" ON "app_message" ("thread_last_reply_at");--> statement-breakpoint
CREATE INDEX "message_receipt_message_id_idx" ON "app_message_receipt" ("message_id");--> statement-breakpoint
CREATE INDEX "message_receipt_member_id_idx" ON "app_message_receipt" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_receipt_message_member_unique" ON "app_message_receipt" ("message_id","member_id");--> statement-breakpoint
CREATE INDEX "message_reference_message_id_idx" ON "app_message_reference" ("message_id");--> statement-breakpoint
CREATE INDEX "comment_entity_idx" ON "app_comment" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "comment_author_id_idx" ON "app_comment" ("author_id");--> statement-breakpoint
CREATE INDEX "comment_parent_id_idx" ON "app_comment" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_pair_unique" ON "app_conversation" ("member_one_id","member_two_id");--> statement-breakpoint
CREATE INDEX "conversation_workspace_id_idx" ON "app_conversation" ("workspace_id");--> statement-breakpoint
CREATE INDEX "conversation_member_one_id_idx" ON "app_conversation" ("member_one_id");--> statement-breakpoint
CREATE INDEX "conversation_member_two_id_idx" ON "app_conversation" ("member_two_id");--> statement-breakpoint
CREATE INDEX "direct_message_conversation_id_idx" ON "app_direct_message" ("conversation_id");--> statement-breakpoint
CREATE INDEX "direct_message_author_id_idx" ON "app_direct_message" ("author_id");--> statement-breakpoint
CREATE INDEX "dm_receipt_message_id_idx" ON "app_direct_message_receipt" ("direct_message_id");--> statement-breakpoint
CREATE INDEX "dm_receipt_member_id_idx" ON "app_direct_message_receipt" ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dm_receipt_message_member_unique" ON "app_direct_message_receipt" ("direct_message_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_entity_idx" ON "app_favorite" ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "favorite_workspace_idx" ON "app_favorite" ("workspace_id");--> statement-breakpoint
CREATE INDEX "note_workspace_id_idx" ON "app_note" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_workspace_id_idx" ON "app_project" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_team_id_idx" ON "app_project" ("team_id");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "app_project_members" ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_member_id_idx" ON "app_project_members" ("member_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "app_tasks" ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_task_id_idx" ON "app_tasks" ("parent_task_id");--> statement-breakpoint
CREATE INDEX "task_assignees_task_id_idx" ON "app_task_assignees" ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignees_member_id_idx" ON "app_task_assignees" ("member_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_task_id_idx" ON "app_tasks_activity" ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_activity_changed_by_idx" ON "app_tasks_activity" ("changed_by");--> statement-breakpoint
CREATE INDEX "project_tags_project_id_idx" ON "app_project_tags" ("project_id");--> statement-breakpoint
CREATE INDEX "project_tags_tag_id_idx" ON "app_project_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "tag_workspace_id_idx" ON "app_tag" ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_tags_task_id_idx" ON "app_task_tags" ("task_id");--> statement-breakpoint
CREATE INDEX "task_tags_tag_id_idx" ON "app_task_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "team_workspace_id_idx" ON "app_team" ("workspace_id");--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "app_team_members" ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_member_id_idx" ON "app_team_members" ("member_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "app_account" ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "app_passkey" ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credential_id_idx" ON "app_passkey" ("credential_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "app_session" ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "app_two_factor" ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "app_two_factor" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "app_verification" ("identifier");--> statement-breakpoint
CREATE INDEX "workspace_user_id_idx" ON "app_workspace" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_name_id_idx" ON "app_workspace" ("name","id");--> statement-breakpoint
CREATE INDEX "workspace_invite_workspace_id_idx" ON "app_workspace_invite_request" ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_invited_by_idx" ON "app_workspace_invite_request" ("invited_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "app_workspace_members" ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "app_workspace_members" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_active_idx" ON "app_workspace_members" ("workspace_id","user_id") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "app_channel" ADD CONSTRAINT "app_channel_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_channel" ADD CONSTRAINT "app_channel_created_by_app_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_channel_members" ADD CONSTRAINT "app_channel_members_channel_id_app_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_channel_members" ADD CONSTRAINT "app_channel_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message" ADD CONSTRAINT "app_message_channel_id_app_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message" ADD CONSTRAINT "app_message_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_message" ADD CONSTRAINT "app_message_parent_message_id_app_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "app_message"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_message_receipt" ADD CONSTRAINT "app_message_receipt_message_id_app_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "app_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message_receipt" ADD CONSTRAINT "app_message_receipt_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_message_reference" ADD CONSTRAINT "app_message_reference_message_id_app_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "app_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_comment" ADD CONSTRAINT "app_comment_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_comment" ADD CONSTRAINT "app_comment_parent_id_app_comment_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "app_comment"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_conversation" ADD CONSTRAINT "app_conversation_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_conversation" ADD CONSTRAINT "app_conversation_member_one_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_one_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_conversation" ADD CONSTRAINT "app_conversation_member_two_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_two_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_direct_message" ADD CONSTRAINT "app_direct_message_conversation_id_app_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "app_conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_direct_message" ADD CONSTRAINT "app_direct_message_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id");--> statement-breakpoint
ALTER TABLE "app_direct_message_receipt" ADD CONSTRAINT "app_direct_message_receipt_Hg5ChsgZATC8_fkey" FOREIGN KEY ("direct_message_id") REFERENCES "app_direct_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_direct_message_receipt" ADD CONSTRAINT "app_direct_message_receipt_NEUYKDqPyHWL_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_favorite" ADD CONSTRAINT "app_favorite_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_favorite" ADD CONSTRAINT "app_favorite_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_note" ADD CONSTRAINT "app_note_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project" ADD CONSTRAINT "app_project_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project" ADD CONSTRAINT "app_project_team_id_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app_team"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_project_members" ADD CONSTRAINT "app_project_members_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_members" ADD CONSTRAINT "app_project_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD CONSTRAINT "app_tasks_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks" ADD CONSTRAINT "app_tasks_parent_task_id_app_tasks_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "app_tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_task_assignees" ADD CONSTRAINT "app_task_assignees_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_assignees" ADD CONSTRAINT "app_task_assignees_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks_activity" ADD CONSTRAINT "app_tasks_activity_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tasks_activity" ADD CONSTRAINT "app_tasks_activity_changed_by_app_workspace_members_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_tags" ADD CONSTRAINT "app_project_tags_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_project_tags" ADD CONSTRAINT "app_project_tags_tag_id_app_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "app_tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_tag" ADD CONSTRAINT "app_tag_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_tags" ADD CONSTRAINT "app_task_tags_task_id_app_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "app_tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_task_tags" ADD CONSTRAINT "app_task_tags_tag_id_app_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "app_tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team" ADD CONSTRAINT "app_team_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team_members" ADD CONSTRAINT "app_team_members_team_id_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app_team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_team_members" ADD CONSTRAINT "app_team_members_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_account" ADD CONSTRAINT "app_account_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_passkey" ADD CONSTRAINT "app_passkey_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_session" ADD CONSTRAINT "app_session_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_two_factor" ADD CONSTRAINT "app_two_factor_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_user_status" ADD CONSTRAINT "app_user_status_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace" ADD CONSTRAINT "app_workspace_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD CONSTRAINT "app_workspace_invite_request_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD CONSTRAINT "app_workspace_invite_request_invited_by_app_user_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_workspace_members" ADD CONSTRAINT "app_workspace_members_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id");--> statement-breakpoint
ALTER TABLE "app_workspace_members" ADD CONSTRAINT "app_workspace_members_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;