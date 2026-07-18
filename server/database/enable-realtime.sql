-- Enable Realtime on Tier 1 tables for cross-tab sync.
-- Run this via: pnpm run db:realtime
-- Or manually: psql "$DATABASE_URL" -f server/database/enable-realtime.sql
--
-- IMPORTANT: After running this, ALWAYS verify with the query below.
-- Do NOT trust the Supabase dashboard toggle — it can silently fail.
--
-- Verify:
--   select schemaname, tablename
--   from pg_publication_tables
--   where pubname = 'supabase_realtime'
--   order by tablename;

alter publication supabase_realtime add table
  app_project,
  app_tasks,
  app_task_assignees,
  app_tasks_activity,
  app_channel,
  app_message,
  app_message_reference,
  app_task_comment,
  app_project_comment,
  app_team,
  app_tag,
  app_project_tags,
  app_task_tags,
  app_workspace,
  app_workspace_members,
  app_workspace_invite_request,
  app_project_members,
  app_channel_members,
  app_team_members,
  app_user_status,
  app_user;
