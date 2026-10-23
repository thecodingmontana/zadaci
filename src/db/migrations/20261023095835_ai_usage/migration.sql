CREATE TABLE "app_ai_usage" (
	"user_id" varchar(16),
	"day" varchar(10),
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "app_ai_usage_pkey" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "app_ai_usage" ADD CONSTRAINT "app_ai_usage_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;