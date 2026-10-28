-- Chat topics on Realtime's private channels: chat:<channelId>.
--   an open channel: anyone in its workspace may join
--   a private channel or a DM: only its members
-- Members may also send on chat topics (typing and who's online); messages themselves are
-- saved and sent by the server. Replaces can_join from realtime_private_channels.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime')
		OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
		RETURN;
	END IF;

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
			WHEN topic LIKE 'chat:%' THEN EXISTS (
				SELECT 1
				FROM app_chat_channel c
				JOIN app_workspace_members m
					ON m.workspace_id = c.workspace_id
					AND m.user_id = uid
					AND m.deleted_at IS NULL
				WHERE c.id = substr(topic, 6)
					AND c.archived_at IS NULL
					AND (
						NOT c.private
						OR EXISTS (
							SELECT 1 FROM app_chat_member cm
							WHERE cm.channel_id = c.id AND cm.member_id = m.id
						)
					)
			)
			ELSE false
		END
	$fn$;

	DROP POLICY IF EXISTS "zadaci chat members can signal" ON realtime.messages;
	CREATE POLICY "zadaci chat members can signal" ON realtime.messages
		FOR INSERT TO authenticated
		WITH CHECK (
			realtime.messages.extension IN ('broadcast', 'presence')
			AND (SELECT realtime.topic()) LIKE 'chat:%'
			AND zadaci_private.can_join(
				(SELECT realtime.topic()),
				(SELECT auth.jwt() ->> 'sub')
			)
		);
END $$;
