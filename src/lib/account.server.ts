import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { USER_ROLE } from "#/db/enums";
import { docToMarkdown } from "#/lib/export";

// Deleting your account and downloading your data.
//
// Deleting erases who you are rather than the rows you share with others: your name, email and
// photo, sign-ins, sessions, AI keys and chats, notifications, private notes and bookmarks are
// removed, and you leave every workspace (the way "remove member" works). Work you shared stays
// with the team under "Deleted user". Workspaces where you're the only member go with you; one
// you own with other people blocks the deletion until you hand it over, so nobody loses their work.

async function memberships(userId: string) {
	return db
		.select({
			memberId: tables.workspace_members.id,
			role: tables.workspace_members.role,
			workspaceId: tables.workspace.id,
			name: tables.workspace.name,
		})
		.from(tables.workspace_members)
		.innerJoin(
			tables.workspace,
			eq(tables.workspace.id, tables.workspace_members.workspace_id),
		)
		.where(
			and(
				eq(tables.workspace_members.user_id, userId),
				isNull(tables.workspace_members.deleted_at),
				isNull(tables.workspace.deleted_at),
			),
		);
}

/** What deleting the account would do: workspaces that block it, and ones that go with it. */
export async function deletionPreview(userId: string) {
	const mine = await memberships(userId);
	const owned = mine.filter((m) => m.role === USER_ROLE.OWNER);
	const others = owned.length
		? await db
				.select({
					workspaceId: tables.workspace_members.workspace_id,
					n: sql<number>`count(*)::int`,
				})
				.from(tables.workspace_members)
				.where(
					and(
						inArray(
							tables.workspace_members.workspace_id,
							owned.map((m) => m.workspaceId),
						),
						ne(tables.workspace_members.user_id, userId),
						isNull(tables.workspace_members.deleted_at),
					),
				)
				.groupBy(tables.workspace_members.workspace_id)
		: [];
	const shared = new Set(
		others.filter((o) => o.n > 0).map((o) => o.workspaceId),
	);
	return {
		mine,
		blockers: owned.filter((m) => shared.has(m.workspaceId)),
		solo: owned.filter((m) => !shared.has(m.workspaceId)),
	};
}

export async function deleteAccount(userId: string) {
	const { mine, blockers, solo } = await deletionPreview(userId);
	if (blockers.length)
		throw new Error(
			`Hand over ${blockers.map((b) => `“${b.name}”`).join(", ")} first: make someone else the owner in its settings, or delete it.`,
		);
	const now = new Date();
	await db.transaction(async (tx) => {
		for (const w of solo)
			await tx
				.update(tables.workspace)
				.set({
					deleted_at: now,
					slug: `deleted-${w.workspaceId.toLowerCase()}`,
				})
				.where(eq(tables.workspace.id, w.workspaceId));
		const memberIds = mine.map((m) => m.memberId);
		if (memberIds.length) {
			await tx
				.update(tables.workspace_members)
				.set({ deleted_at: now })
				.where(inArray(tables.workspace_members.id, memberIds));
			for (const t of [
				tables.project_members,
				tables.team_members,
				tables.task_assignees,
			])
				await tx
					.update(t)
					.set({ deleted_at: now })
					.where(and(inArray(t.member_id, memberIds), isNull(t.deleted_at)));
		}
		// what only you could see goes with you
		await tx
			.update(tables.note)
			.set({ deleted_at: now })
			.where(
				and(eq(tables.note.created_by, userId), eq(tables.note.private, true)),
			);
		await tx
			.update(tables.bookmark)
			.set({ deleted_at: now })
			.where(
				and(
					eq(tables.bookmark.created_by, userId),
					eq(tables.bookmark.private, true),
				),
			);
		for (const t of [
			tables.session,
			tables.account,
			tables.passkey,
			tables.twoFactor,
		])
			await tx.delete(t).where(eq(t.userId, userId));
		for (const t of [
			tables.push_subscription,
			tables.notification,
			tables.favorite,
			tables.ai_conversation,
			tables.ai_usage,
			tables.ai_user_key,
			tables.daily_sent,
			tables.user_status,
		])
			await tx.delete(t).where(eq(t.user_id, userId));
		await tx
			.update(tables.user)
			.set({
				name: "Deleted user",
				email: `deleted-${userId.toLowerCase()}@users.zadaci.invalid`,
				emailVerified: false,
				image: null,
				twoFactorEnabled: false,
				preferences: {},
			})
			.where(eq(tables.user.id, userId));
	});
}

/** Everything that's yours, as one JSON document (AI keys only as their last characters). */
export async function exportAccount(userId: string) {
	const [me] = await db
		.select()
		.from(tables.user)
		.where(eq(tables.user.id, userId));
	const mine = await memberships(userId);
	const memberIds = mine.map((m) => m.memberId);
	const any = memberIds.length ? memberIds : ["-"];
	const [tasks, comments, notes, bookmarks, keys, messages] = await Promise.all(
		[
			db
				.select({
					title: tables.task.name,
					status: tables.task.status,
					due: tables.task.due_date,
					project: tables.project.title,
				})
				.from(tables.task_assignees)
				.innerJoin(
					tables.task,
					eq(tables.task.id, tables.task_assignees.task_id),
				)
				.innerJoin(
					tables.project,
					eq(tables.project.id, tables.task.project_id),
				)
				.where(
					and(
						inArray(tables.task_assignees.member_id, any),
						isNull(tables.task_assignees.deleted_at),
						isNull(tables.task.deleted_at),
					),
				),
			db
				.select({
					on: tables.comment.entity_type,
					text: tables.comment.content,
					at: tables.comment.created_at,
				})
				.from(tables.comment)
				.where(inArray(tables.comment.author_id, any)),
			db
				.select({
					title: tables.note.title,
					doc: tables.note.doc,
					private: tables.note.private,
					at: tables.note.created_at,
				})
				.from(tables.note)
				.where(
					and(
						eq(tables.note.created_by, userId),
						isNull(tables.note.deleted_at),
					),
				),
			db
				.select({
					title: tables.bookmark.title,
					url: tables.bookmark.url,
					tags: tables.bookmark.tags,
					at: tables.bookmark.created_at,
				})
				.from(tables.bookmark)
				.where(
					and(
						eq(tables.bookmark.created_by, userId),
						isNull(tables.bookmark.deleted_at),
					),
				),
			db
				.select({
					provider: tables.ai_user_key.provider,
					hint: tables.ai_user_key.hint,
					model: tables.ai_user_key.model,
				})
				.from(tables.ai_user_key)
				.where(eq(tables.ai_user_key.user_id, userId)),
			db
				.select({
					role: tables.ai_message.role,
					content: tables.ai_message.content,
					at: tables.ai_message.created_at,
				})
				.from(tables.ai_message)
				.where(eq(tables.ai_message.user_id, userId))
				.orderBy(tables.ai_message.created_at),
		],
	);
	return {
		exportedAt: new Date().toISOString(),
		profile: me && {
			name: me.name,
			email: me.email,
			image: me.image,
			createdAt: me.createdAt,
			preferences: me.preferences,
		},
		workspaces: mine.map((m) => ({ name: m.name, role: m.role })),
		tasks,
		comments,
		notes: notes.map((n) => ({
			title: n.title,
			private: n.private,
			createdAt: n.at,
			text: docToMarkdown(n.title, n.doc),
		})),
		bookmarks,
		assistant: {
			keys,
			messages: messages.filter(
				(m) => m.role === "user" || m.role === "assistant",
			),
		},
	};
}
