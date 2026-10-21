CREATE TABLE "app_push_subscription" (
	"id" varchar(16) PRIMARY KEY,
	"user_id" varchar(16) NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "app_push_subscription" ("user_id");--> statement-breakpoint
ALTER TABLE "app_push_subscription" ADD CONSTRAINT "app_push_subscription_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;