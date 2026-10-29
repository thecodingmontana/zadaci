-- A project's or task's own chat follows the project, as the app does (projectRight): admins, its
-- lead, people added to it, and non-guests when it's shared with the workspace may listen. Before,
-- it fell back to "has opened it", so someone taken off the project could still watch it live.
-- Same rules as before otherwise.
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
			WHEN can_join.uid IS NULL OR can_join.uid = '' THEN false
			WHEN can_join.topic LIKE 'user:%' THEN substr(can_join.topic, 6) = can_join.uid
			WHEN can_join.topic LIKE 'ws:%' THEN EXISTS (
				SELECT 1 FROM app_workspace_members m
				WHERE m.workspace_id = substr(can_join.topic, 4)
					AND m.user_id = can_join.uid
					AND m.deleted_at IS NULL
			)
			WHEN can_join.topic LIKE 'chat:%' THEN EXISTS (
				SELECT 1
				FROM app_chat_channel c
				JOIN app_workspace_members m
					ON m.workspace_id = c.workspace_id
					AND m.user_id = can_join.uid
					AND m.deleted_at IS NULL
				WHERE c.id = substr(can_join.topic, 6)
					AND c.archived_at IS NULL
					AND CASE
						WHEN c.team_id IS NOT NULL THEN EXISTS (
							SELECT 1 FROM app_team_members tm
							JOIN app_team t ON t.id = tm.team_id AND t.deleted_at IS NULL
							WHERE tm.team_id = c.team_id
								AND tm.member_id = m.id
								AND tm.deleted_at IS NULL
						)
						WHEN c.follows_project THEN EXISTS (
							SELECT 1 FROM app_project p
							WHERE p.id = c.project_id
								AND p.deleted_at IS NULL
								AND (
									m.role::text IN ('owner', 'moderator')
									OR p.lead_id = m.id
									OR (p.access = 'workspace' AND m.role::text <> 'guest')
									OR EXISTS (
										SELECT 1 FROM app_project_members pm
										WHERE pm.project_id = p.id
											AND pm.member_id = m.id
											AND pm.deleted_at IS NULL
									)
								)
						)
						WHEN NOT c.private THEN true
						ELSE EXISTS (
							SELECT 1 FROM app_chat_member cm
							WHERE cm.channel_id = c.id AND cm.member_id = m.id
						)
					END
			)
			ELSE false
		END
	$fn$;
END $$;
