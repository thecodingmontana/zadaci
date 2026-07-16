import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  user: {
    credentials: r.many.passkeys(),
    owned_workspaces: r.many.workspace(),
    workspaces: r.many.workspace_members(),
    oauth_accounts: r.many.oauth_account(),
    password_reset_sessions: r.many.password_reset_session(),
    created_channels: r.many.channel(),
    user_status: r.one.user_status(),
  },
  workspace: {
    owner: r.one.user({
      from: r.workspace.user_id,
      to: r.user.id,
    }),
    members: r.many.workspace_members(),
    projects: r.many.project(),
    channels: r.many.channel(),
    teams: r.many.team(),
    tags: r.many.tag(),
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
    channel_memberships: r.many.channel_members(),
    messages: r.many.message(),
    task_comments: r.many.task_comment(),
    project_comments: r.many.project_comment(),
    team_memberships: r.many.team_members(),
  },
  project: {
    workspace: r.one.workspace({
      from: r.project.workspace_id,
      to: r.workspace.id,
    }),
    team: r.one.team({
      from: r.project.team_id,
      to: r.team.id,
    }),
    tasks: r.many.task(),
    members: r.many.project_members(),
    comments: r.many.project_comment(),
    project_tags: r.many.project_tags(),
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
  project_comment: {
    project: r.one.project({
      from: r.project_comment.project_id,
      to: r.project.id,
    }),
    author: r.one.workspace_members({
      from: r.project_comment.author_id,
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
    comments: r.many.task_comment(),
    task_tags: r.many.task_tags(),
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
  task_comment: {
    task: r.one.task({
      from: r.task_comment.task_id,
      to: r.task.id,
    }),
    author: r.one.workspace_members({
      from: r.task_comment.author_id,
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
  channel: {
    workspace: r.one.workspace({
      from: r.channel.workspace_id,
      to: r.workspace.id,
    }),
    created_by_user: r.one.user({
      from: r.channel.created_by,
      to: r.user.id,
    }),
    members: r.many.channel_members(),
    messages: r.many.message(),
  },
  channel_members: {
    channel: r.one.channel({
      from: r.channel_members.channel_id,
      to: r.channel.id,
    }),
    member: r.one.workspace_members({
      from: r.channel_members.member_id,
      to: r.workspace_members.id,
    }),
  },
  message: {
    channel: r.one.channel({
      from: r.message.channel_id,
      to: r.channel.id,
    }),
    author: r.one.workspace_members({
      from: r.message.author_id,
      to: r.workspace_members.id,
    }),
    references: r.many.message_reference(),
  },
  message_reference: {
    message: r.one.message({
      from: r.message_reference.message_id,
      to: r.message.id,
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
  team: {
    workspace: r.one.workspace({
      from: r.team.workspace_id,
      to: r.workspace.id,
    }),
    members: r.many.team_members(),
    projects: r.many.project(),
  },
  team_members: {
    team: r.one.team({
      from: r.team_members.team_id,
      to: r.team.id,
    }),
    member: r.one.workspace_members({
      from: r.team_members.member_id,
      to: r.workspace_members.id,
    }),
  },
  tag: {
    workspace: r.one.workspace({
      from: r.tag.workspace_id,
      to: r.workspace.id,
    }),
    project_tags: r.many.project_tags(),
    task_tags: r.many.task_tags(),
  },
  project_tags: {
    project: r.one.project({
      from: r.project_tags.project_id,
      to: r.project.id,
    }),
    tag: r.one.tag({
      from: r.project_tags.tag_id,
      to: r.tag.id,
    }),
  },
  task_tags: {
    task: r.one.task({
      from: r.task_tags.task_id,
      to: r.task.id,
    }),
    tag: r.one.tag({
      from: r.task_tags.tag_id,
      to: r.tag.id,
    }),
  },
  user_status: {
    user: r.one.user({
      from: r.user_status.user_id,
      to: r.user.id,
    }),
  },
}));
