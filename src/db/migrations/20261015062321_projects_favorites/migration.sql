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
ALTER TABLE "app_project" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "archived_at" timestamp(3) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_entity_idx" ON "app_favorite" ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "favorite_workspace_idx" ON "app_favorite" ("workspace_id");--> statement-breakpoint
ALTER TABLE "app_favorite" ADD CONSTRAINT "app_favorite_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_favorite" ADD CONSTRAINT "app_favorite_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;