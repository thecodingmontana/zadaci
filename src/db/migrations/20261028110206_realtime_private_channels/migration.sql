-- Supabase Realtime private channels: a browser may join a topic only if it belongs there.
--   user:<userId>       your own (unread counts, things meant for you)
--   ws:<workspaceId>    a workspace you're a member of (live updates)
-- The check reads app tables, which are closed to the Supabase API roles, so it runs as its
-- owner, in a schema the Supabase API doesn't expose (nobody can call it to probe membership).
-- Only the server sends on these topics (with the secret key), so there is no "send" policy.
-- Skipped on plain Postgres (tests, local), which has no realtime or auth schema.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime')
		OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
		RETURN;
	END IF;

	CREATE SCHEMA IF NOT EXISTS zadaci_private;
	REVOKE ALL ON SCHEMA zadaci_private FROM public, anon;
	GRANT USAGE ON SCHEMA zadaci_private TO authenticated;

	CREATE OR REPLACE FUNCTION zadaci_private.can_join(topic text, uid text)
	RETURNS boolean
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = public, pg_temp
	AS $fn$
		SELECT CASE
			WHEN uid IS NULL OR uid = '' THEN false
			WHEN topic LIKE 'user:%' THEN substr(topic, 6) = uid
			WHEN topic LIKE 'ws:%' THEN EXISTS (
				SELECT 1 FROM app_workspace_members m
				WHERE m.workspace_id = substr(topic, 4)
					AND m.user_id = uid
					AND m.deleted_at IS NULL
			)
			ELSE false
		END
	$fn$;
	REVOKE ALL ON FUNCTION zadaci_private.can_join(text, text) FROM public, anon;
	GRANT EXECUTE ON FUNCTION zadaci_private.can_join(text, text) TO authenticated;

	DROP POLICY IF EXISTS "zadaci members can listen" ON realtime.messages;
	CREATE POLICY "zadaci members can listen" ON realtime.messages
		FOR SELECT TO authenticated
		USING (
			realtime.messages.extension IN ('broadcast', 'presence')
			AND zadaci_private.can_join(
				(SELECT realtime.topic()),
				(SELECT auth.jwt() ->> 'sub')
			)
		);
END $$;
