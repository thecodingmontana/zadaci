CREATE TABLE "app_ai_conversation" (
	"id" varchar(64) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"workspace_id" varchar(16) NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_ai_message" (
	"id" varchar(16) PRIMARY KEY,
	"conversation_id" varchar(64) NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"position" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" jsonb,
	"tool_calls" jsonb,
	"tool_call_id" varchar(120),
	"model" varchar(160),
	"extra" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_conversation_user_idx" ON "app_ai_conversation" ("user_id","workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "ai_message_conversation_idx" ON "app_ai_message" ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "ai_message_user_idx" ON "app_ai_message" ("user_id");--> statement-breakpoint
ALTER TABLE "app_ai_conversation" ADD CONSTRAINT "app_ai_conversation_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_ai_conversation" ADD CONSTRAINT "app_ai_conversation_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_ai_message" ADD CONSTRAINT "app_ai_message_conversation_id_app_ai_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "app_ai_conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_ai_message" ADD CONSTRAINT "app_ai_message_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;