CREATE TABLE IF NOT EXISTS "app_contribution" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"contribution_date" date NOT NULL,
	"source" varchar(32) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_user_date_source_unique" ON "app_contribution" ("user_id","contribution_date","source");
--> statement-breakpoint
ALTER TABLE "app_contribution" ADD CONSTRAINT "app_contribution_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;
