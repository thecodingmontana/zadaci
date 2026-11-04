ALTER TABLE "app_github_account" ADD COLUMN "refresh_token" text;--> statement-breakpoint
ALTER TABLE "app_github_account" ADD COLUMN "expires_at" timestamp with time zone;