CREATE TABLE "app_passkey" (
	"id" text PRIMARY KEY,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" varchar(16) NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "app_passkey" ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credential_id_idx" ON "app_passkey" ("credential_id");--> statement-breakpoint
ALTER TABLE "app_passkey" ADD CONSTRAINT "app_passkey_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;