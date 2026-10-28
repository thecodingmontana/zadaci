CREATE TABLE "app_chat_channel" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"kind" varchar(10) NOT NULL,
	"name" varchar(80),
	"topic" varchar(250),
	"private" boolean DEFAULT false NOT NULL,
	"created_by" varchar(16),
	"last_message_at" timestamp(3) with time zone,
	"archived_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_chat_member" (
	"id" varchar(16) PRIMARY KEY,
	"channel_id" varchar(16) NOT NULL,
	"member_id" varchar(16) NOT NULL,
	"last_read_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_chat_message" (
	"id" varchar(16) PRIMARY KEY,
	"channel_id" varchar(16) NOT NULL,
	"author_id" varchar(16),
	"body" text NOT NULL,
	"reactions" jsonb DEFAULT '{}' NOT NULL,
	"edited_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "chat_channel_workspace_idx" ON "app_chat_channel" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_member_unique" ON "app_chat_member" ("channel_id","member_id");--> statement-breakpoint
CREATE INDEX "chat_member_member_idx" ON "app_chat_member" ("member_id");--> statement-breakpoint
CREATE INDEX "chat_message_channel_idx" ON "app_chat_message" ("channel_id","created_at");--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD CONSTRAINT "app_chat_channel_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD CONSTRAINT "app_chat_channel_created_by_app_workspace_members_id_fkey" FOREIGN KEY ("created_by") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_chat_member" ADD CONSTRAINT "app_chat_member_channel_id_app_chat_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_chat_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_member" ADD CONSTRAINT "app_chat_member_member_id_app_workspace_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "app_workspace_members"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD CONSTRAINT "app_chat_message_channel_id_app_chat_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "app_chat_channel"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD CONSTRAINT "app_chat_message_author_id_app_workspace_members_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;
--> statement-breakpoint
-- closed to the Supabase API roles, like every app table
ALTER TABLE "app_chat_channel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_chat_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_chat_message" ENABLE ROW LEVEL SECURITY;
