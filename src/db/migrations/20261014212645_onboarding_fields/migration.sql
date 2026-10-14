ALTER TABLE "app_project" ADD COLUMN "icon" varchar(60);--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "color" varchar(20);--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "slug" varchar(48) NOT NULL;--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "use_case" varchar(20);--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "team_size" varchar(10);--> statement-breakpoint
ALTER TABLE "app_workspace" ADD COLUMN "default_view" varchar(10) DEFAULT 'board' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_workspace" ALTER COLUMN "image_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_workspace" ADD CONSTRAINT "app_workspace_slug_key" UNIQUE("slug");