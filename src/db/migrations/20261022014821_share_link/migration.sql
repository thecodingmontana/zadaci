CREATE TABLE "app_share_link" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"entity_type" varchar(16) NOT NULL,
	"entity_id" varchar(16) NOT NULL,
	"token" varchar(32) NOT NULL,
	"created_by" varchar(16) NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_token_idx" ON "app_share_link" ("token");--> statement-breakpoint
CREATE INDEX "share_link_entity_idx" ON "app_share_link" ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "app_share_link" ADD CONSTRAINT "app_share_link_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;