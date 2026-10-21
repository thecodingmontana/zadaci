CREATE TABLE "app_daily_sent" (
	"user_id" varchar(16),
	"day" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_daily_sent_pkey" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "app_daily_sent" ADD CONSTRAINT "app_daily_sent_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;