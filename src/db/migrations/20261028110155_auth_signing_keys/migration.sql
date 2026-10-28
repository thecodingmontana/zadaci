CREATE TABLE "app_jwks" (
	"id" text PRIMARY KEY,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone
);

-- like every app table: closed to the Supabase API roles; the app reaches it as its own role
ALTER TABLE "app_jwks" ENABLE ROW LEVEL SECURITY;
