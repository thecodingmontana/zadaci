ALTER TABLE "app_project" ADD COLUMN "access" varchar(20) DEFAULT 'workspace' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_project" ADD COLUMN "lead_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_project_members" ADD COLUMN "permission" varchar(20);--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD COLUMN "project_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD COLUMN "project_permission" varchar(20);--> statement-breakpoint
ALTER TABLE "app_project" ADD CONSTRAINT "app_project_lead_id_app_workspace_members_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_workspace_invite_request" ADD CONSTRAINT "app_workspace_invite_request_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;