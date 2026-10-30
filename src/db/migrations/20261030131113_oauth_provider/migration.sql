CREATE TABLE "app_oauth_access_token" (
	"id" text PRIMARY KEY,
	"token" text UNIQUE,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" varchar(16),
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"refresh_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"revoked" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_oauth_client" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL UNIQUE,
	"client_secret" text,
	"client_discovery_id" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"client_credentials_scopes" text[] DEFAULT '{}'::text[],
	"user_id" varchar(16),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"token_endpoint_auth_method" text,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"grant_types" text[],
	"response_types" text[],
	"require_pkce" boolean,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	"reference_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "app_oauth_client_assertion" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_oauth_client_resource" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_oauth_consent" (
	"id" text PRIMARY KEY,
	"client_id" text NOT NULL,
	"user_id" varchar(16),
	"reference_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_oauth_refresh_token" (
	"id" text PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" varchar(16) NOT NULL,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"revoked" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"rotation_replay_response" text,
	"rotation_replay_expires_at" timestamp with time zone,
	"auth_time" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_oauth_resource" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "oauth_access_token_user_idx" ON "app_oauth_access_token" ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resource_client_idx" ON "app_oauth_client_resource" ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_consent_user_idx" ON "app_oauth_consent" ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_token_user_idx" ON "app_oauth_refresh_token" ("user_id");--> statement-breakpoint
ALTER TABLE "app_oauth_access_token" ADD CONSTRAINT "app_oauth_access_token_wNeqyKPqt4xg_fkey" FOREIGN KEY ("client_id") REFERENCES "app_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_access_token" ADD CONSTRAINT "app_oauth_access_token_session_id_app_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "app_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_oauth_access_token" ADD CONSTRAINT "app_oauth_access_token_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_access_token" ADD CONSTRAINT "app_oauth_access_token_hebdLsrhlcKM_fkey" FOREIGN KEY ("refresh_id") REFERENCES "app_oauth_refresh_token"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_client" ADD CONSTRAINT "app_oauth_client_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_client_resource" ADD CONSTRAINT "app_oauth_client_resource_uLAswT2scsuK_fkey" FOREIGN KEY ("client_id") REFERENCES "app_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_client_resource" ADD CONSTRAINT "app_oauth_client_resource_vV1RQHh8UPgw_fkey" FOREIGN KEY ("resource_id") REFERENCES "app_oauth_resource"("identifier") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_consent" ADD CONSTRAINT "app_oauth_consent_client_id_app_oauth_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "app_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_consent" ADD CONSTRAINT "app_oauth_consent_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_token" ADD CONSTRAINT "app_oauth_refresh_token_ZRm1dmjvxvcr_fkey" FOREIGN KEY ("client_id") REFERENCES "app_oauth_client"("client_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_token" ADD CONSTRAINT "app_oauth_refresh_token_session_id_app_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "app_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_token" ADD CONSTRAINT "app_oauth_refresh_token_user_id_app_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;