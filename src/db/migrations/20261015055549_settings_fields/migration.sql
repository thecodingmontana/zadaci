ALTER TABLE "app_team" ADD COLUMN "icon" varchar(60);--> statement-breakpoint
ALTER TABLE "app_team" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "preferences" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "color" varchar(20);--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "settings" jsonb DEFAULT '{}' NOT NULL;