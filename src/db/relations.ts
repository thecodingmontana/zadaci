import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	user: {
		sessions: r.many.session(),
		accounts: r.many.account(),
		two_factors: r.many.twoFactor(),
		passkeys: r.many.passkey(),
		owned_workspaces: r.many.workspace(),
		workspaces: r.many.workspace_members(),
		user_status: r.one.user_status(),
	},
	workspace: {
		owner: r.one.user({
			from: r.workspace.user_id,
			to: r.user.id,
		}),
		members: r.many.workspace_members(),
		projects: r.many.project(),
		teams: r.many.team(),
		tags: r.many.tag(),
		notes: r.many.note(),
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
		comments: r.many.comment(),
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
	task: {
		project: r.one.project({
			from: r.task.project_id,
			to: r.project.id,
		}),
		parent_task: r.one.task({
			from: r.task.parent_task_id,
			to: r.task.id,
		}),
		subtasks: r.many.task({
			from: r.task.id,
			to: r.task.parent_task_id,
		}),
		activities: r.many.tasks_activity(),
		assignees: r.many.task_assignees(),
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
	session: {
		user: r.one.user({ from: r.session.userId, to: r.user.id }),
	},
	account: {
		user: r.one.user({ from: r.account.userId, to: r.user.id }),
	},
	twoFactor: {
		user: r.one.user({ from: r.twoFactor.userId, to: r.user.id }),
	},
	passkey: {
		user: r.one.user({ from: r.passkey.userId, to: r.user.id }),
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
	note: {
		workspace: r.one.workspace({
			from: r.note.workspace_id,
			to: r.workspace.id,
		}),
	},
	comment: {
		author: r.one.workspace_members({
			from: r.comment.author_id,
			to: r.workspace_members.id,
		}),
		parent: r.one.comment({
			from: r.comment.parent_id,
			to: r.comment.id,
		}),
		replies: r.many.comment({
			from: r.comment.id,
			to: r.comment.parent_id,
		}),
	},
}));
