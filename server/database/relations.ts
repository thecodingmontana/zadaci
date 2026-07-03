import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  user: {
    credentials: r.many.passkeys(),
    owned_workspaces: r.many.workspace(),
    workspaces: r.many.workspace_members(),
    oauth_accounts: r.many.oauth_account(),
    password_reset_sessions: r.many.password_reset_session(),
  },
  workspace: {
    owner: r.one.user({
      from: r.workspace.user_id,
      to: r.user.id,
    }),
    members: r.many.workspace_members(),
    projects: r.many.project(),
  },
  workspace_members: {
    user: r.one.user({
      from: r.workspace_members.user_id,
      to: r.user.id,
    }),
    workspace: r.one.workspace({
      from: r.workspace_members.workspace_id,
      to: r.workspace.id,
    }),
    tasks: r.many.task_assignees(),
    activities: r.many.tasks_activity(),
    project_memberships: r.many.project_members(),
  },
  project: {
    workspace: r.one.workspace({
      from: r.project.workspace_id,
      to: r.workspace.id,
    }),
    tasks: r.many.task(),
    members: r.many.project_members(),
  },
  project_members: {
    project: r.one.project({
      from: r.project_members.project_id,
      to: r.project.id,
    }),
    member: r.one.workspace_members({
      from: r.project_members.member_id,
      to: r.workspace_members.id,
    }),
  },
  task: {
    project: r.one.project({
      from: r.task.project_id,
      to: r.project.id,
    }),
    subtasks: r.many.subtasks(),
    activities: r.many.tasks_activity(),
    assignees: r.many.task_assignees(),
  },
  task_assignees: {
    task: r.one.task({
      from: r.task_assignees.task_id,
      to: r.task.id,
    }),
    member: r.one.workspace_members({
      from: r.task_assignees.member_id,
      to: r.workspace_members.id,
    }),
  },
  subtasks: {
    task: r.one.task({
      from: r.subtasks.task_id,
      to: r.task.id,
    }),
  },
  tasks_activity: {
    task: r.one.task({
      from: r.tasks_activity.task_id,
      to: r.task.id,
    }),
    member: r.one.workspace_members({
      from: r.tasks_activity.changed_by,
      to: r.workspace_members.id,
    }),
  },
  passkeys: {
    user: r.one.user({
      from: r.passkeys.user_id,
      to: r.user.id,
    }),
  },
  oauth_account: {
    user: r.one.user({
      from: r.oauth_account.user_id,
      to: r.user.id,
    }),
  },
  password_reset_session: {
    user: r.one.user({
      from: r.password_reset_session.user_id,
      to: r.user.id,
    }),
  },
  workspace_invite_request: {
    user: r.one.user({
      from: r.workspace_invite_request.invited_by,
      to: r.user.id,
    }),
    workspace: r.one.workspace({
      from: r.workspace_invite_request.workspace_id,
      to: r.workspace.id,
    }),
  },
}));
