CREATE TABLE "app_bookmark" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image" text,
	"site" varchar(200),
	"kind" varchar(16) DEFAULT 'article' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"created_by" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_bookmark_collection" (
	"id" varchar(16) PRIMARY KEY,
	"workspace_id" varchar(16) NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(16),
	"private" boolean DEFAULT false NOT NULL,
	"project_id" varchar(16),
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"created_by" varchar(16) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "app_bookmark_collections" (
	"bookmark_id" varchar(16),
	"collection_id" varchar(16),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_bookmark_collections_pkey" PRIMARY KEY("bookmark_id","collection_id")
);
--> statement-breakpoint
CREATE INDEX "bookmark_workspace_created_idx" ON "app_bookmark" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "bookmark_collection_workspace_id_idx" ON "app_bookmark_collection" ("workspace_id");--> statement-breakpoint
CREATE INDEX "bookmark_collections_collection_idx" ON "app_bookmark_collections" ("collection_id");--> statement-breakpoint
ALTER TABLE "app_bookmark" ADD CONSTRAINT "app_bookmark_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_bookmark_collection" ADD CONSTRAINT "app_bookmark_collection_workspace_id_app_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "app_workspace"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_bookmark_collection" ADD CONSTRAINT "app_bookmark_collection_project_id_app_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "app_project"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_bookmark_collections" ADD CONSTRAINT "app_bookmark_collections_bookmark_id_app_bookmark_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "app_bookmark"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_bookmark_collections" ADD CONSTRAINT "app_bookmark_collections_rCWyu6qdRGHr_fkey" FOREIGN KEY ("collection_id") REFERENCES "app_bookmark_collection"("id") ON DELETE CASCADE;