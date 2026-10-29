-- Realtime: who's online. Every open tab shares its presence on its workspace's private ws:<id>
-- topic, so members may send presence there (never broadcasts: changes come from the server).
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime')
		OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
		RETURN;
	END IF;

	DROP POLICY IF EXISTS "zadaci members share presence" ON realtime.messages;
	CREATE POLICY "zadaci members share presence" ON realtime.messages
		FOR INSERT TO authenticated
		WITH CHECK (
			realtime.messages.extension = 'presence'
			AND (SELECT realtime.topic()) LIKE 'ws:%'
			AND zadaci_private.can_join(
				(SELECT realtime.topic()),
				(SELECT auth.jwt() ->> 'sub')
			)
		);
END $$;
