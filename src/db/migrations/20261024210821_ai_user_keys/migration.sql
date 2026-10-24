CREATE TABLE "app_ai_user_key" (
	"user_id" varchar(16),
	"provider" varchar(24),
	"cipher" text NOT NULL,
	"hint" varchar(8) NOT NULL,
	"model" varchar(120) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_ai_user_key_pkey" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "app_ai_user_key" ADD CONSTRAINT "app_ai_user_key_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;