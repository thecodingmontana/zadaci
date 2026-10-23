CREATE TABLE "app_ai_model" (
	"id" varchar(160) PRIMARY KEY,
	"rank" integer,
	"context" integer,
	"ranked_at" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"last_error" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"successes" integer DEFAULT 0 NOT NULL,
	"last_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
