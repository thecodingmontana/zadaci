-- The app reaches the database only as its own server role, which bypasses RLS. Supabase also
-- exposes these tables over its REST and GraphQL APIs to anyone holding the public anon key
-- (which the browser has for live updates), so turn RLS on with no policies and drop the API
-- roles' access, now and for tables added later. Skipped on plain Postgres without those roles.
DO $$
DECLARE t record;
BEGIN
	FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
		EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
	END LOOP;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
		AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
		REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
		REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
	END IF;
END $$;
