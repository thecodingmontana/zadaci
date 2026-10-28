ALTER TABLE "app_chat_channel" ADD COLUMN "team_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_chat_member" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD COLUMN "parent_id" varchar(16);--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD COLUMN "pinned_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD COLUMN "pinned_by" varchar(16);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_channel_team_unique" ON "app_chat_channel" ("team_id") WHERE team_id is not null;--> statement-breakpoint
CREATE INDEX "chat_message_parent_idx" ON "app_chat_message" ("parent_id","created_at");--> statement-breakpoint
ALTER TABLE "app_chat_channel" ADD CONSTRAINT "app_chat_channel_team_id_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app_team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD CONSTRAINT "app_chat_message_parent_id_app_chat_message_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "app_chat_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_chat_message" ADD CONSTRAINT "app_chat_message_pinned_by_app_workspace_members_id_fkey" FOREIGN KEY ("pinned_by") REFERENCES "app_workspace_members"("id") ON DELETE SET NULL;--> statement-breakpoint
-- Realtime: a team's channel is for the team's current members (leaving the team ends access).
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
					AND CASE
						WHEN c.team_id IS NOT NULL THEN EXISTS (
							SELECT 1 FROM app_team_members tm
							JOIN app_team t ON t.id = tm.team_id AND t.deleted_at IS NULL
							WHERE tm.team_id = c.team_id
								AND tm.member_id = m.id
								AND tm.deleted_at IS NULL
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
