import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { afterRequest } from "#/lib/email.server";
import { github } from "#/lib/github-connect.server";
import { actingAs, gql, linkOf, quiet, track } from "#/lib/github-sync.server";
import { recordError } from "#/lib/ops.server";

// Task comments ↔ GitHub issue comments, for projects linked through the GitHub App. A comment
// made in Zadaci goes onto the task's issue (as whoever linked the repo, naming the author);
// one made on GitHub becomes a task comment. Ours carry a hidden marker, so they don't come back.

const marker = (commentId: string) => `<!-- zadaci:comment:${commentId} -->`;
const OURS = /<!-- zadaci:comment:[A-Za-z0-9_-]+ -->/;
const MAX_TEXT = 9_000;

const t = tables;
const sameRepo = (repo: string) =>
	sql`lower(${t.task_github_comment.repo}) = lower(${repo})`;

/** After this request: put the comment on the task's issue, or take it off once deleted. */
export function queueCommentSync(commentId: string) {
	if (quiet.getStore()) return; // it came from GitHub
	afterRequest(() =>
		track(
			syncComment(commentId).catch((error) =>
				recordError(
					"github",
					`comment ${commentId}: ${(error as Error).message}`,
				),
			),
		),
	);
}

/** Zadaci → GitHub. True when it wrote to GitHub. */
export async function syncComment(commentId: string) {
	const [row] = await db
		.select({ comment: t.comment, author: t.user.name, task: t.task })
		.from(t.comment)
		.innerJoin(
			t.task,
			and(
				eq(t.comment.entity_type, "task"),
				eq(t.task.id, t.comment.entity_id),
			),
		)
		.innerJoin(
			t.workspace_members,
			eq(t.workspace_members.id, t.comment.author_id),
		)
		.innerJoin(t.user, eq(t.user.id, t.workspace_members.user_id))
		.where(eq(t.comment.id, commentId));
	if (!row) return false;
	const link = await linkOf(row.task.project_id);
	if (!link) return false;
	const [twin] = await db
		.select()
		.from(t.task_github_comment)
		.where(eq(t.task_github_comment.comment_id, commentId));
	if (row.comment.deleted_at) {
		if (!twin) return false;
		const res = await github(
			link.token,
			`/repos/${twin.repo}/issues/comments/${twin.github_id}`,
			"DELETE",
		);
		// already gone on GitHub is fine
		if (!res.ok && res.status !== 404)
			throw new Error(`GitHub answered ${res.status} deleting a comment`);
		await db
			.delete(t.task_github_comment)
			.where(eq(t.task_github_comment.comment_id, commentId));
		return true;
	}
	if (twin) return false;
	const [issue] = await db
		.select({ number: t.task_github_issue.number })
		.from(t.task_github_issue)
		.where(
			and(
				eq(t.task_github_issue.task_id, row.task.id),
				isNotNull(t.task_github_issue.number),
				sql`lower(${t.task_github_issue.repo}) = lower(${link.repo})`,
			),
		);
	// shortcut: a task whose issue is still being opened keeps this comment Zadaci-only; fine
	// for a task that was linked a moment ago
	if (!issue?.number) return false;
	const res = await github(
		link.token,
		`/repos/${link.repo}/issues/${issue.number}/comments`,
		"POST",
		{
			body: `**${row.author}** commented in Zadaci:\n\n${row.comment.content}\n\n${marker(commentId)}`,
		},
	);
	if (!res.ok)
		throw new Error(`GitHub answered ${res.status} adding a comment`);
	const { id } = (await res.json()) as { id: number };
	await db
		.insert(t.task_github_comment)
		.values({ comment_id: commentId, repo: link.repo, github_id: id })
		.onConflictDoNothing();
	return true;
}

export type CommentEvent = {
	action?: string;
	comment?: {
		id: number;
		body: string | null;
		user?: { login?: string } | null;
	};
	issue?: { number: number; pull_request?: unknown };
	repository?: { full_name?: string };
};

const fromGitHub = (comment: NonNullable<CommentEvent["comment"]>) =>
	`**@${comment.user?.login ?? "someone"}** on GitHub:\n\n${(comment.body ?? "").slice(0, MAX_TEXT)}`;

/** GitHub → Zadaci (the app's `issue_comment` webhook): a comment on a synced issue is added to,
 * changed on or removed from its task. */
export async function applyCommentEvent({
	action,
	comment,
	issue,
	repository,
}: CommentEvent) {
	const repo = repository?.full_name;
	if (!comment || !issue || !repo || issue.pull_request) return { changed: 0 };
	if (OURS.test(comment.body ?? "")) return { changed: 0 }; // one we posted, coming back
	const [twin] = await db
		.select()
		.from(t.task_github_comment)
		.where(
			and(sameRepo(repo), eq(t.task_github_comment.github_id, comment.id)),
		);
	if (action === "edited" || action === "deleted") {
		if (!twin) return { changed: 0 };
		await db
			.update(t.comment)
			.set(
				action === "deleted"
					? { deleted_at: new Date() }
					: { content: fromGitHub(comment), updated_at: new Date() },
			)
			.where(eq(t.comment.id, twin.comment_id));
		return { changed: 1 };
	}
	if (action !== "created" || twin) return { changed: 0 };
	// the task (in a project linked through the app) whose issue this is
	const mapped = await db
		.select({
			taskId: t.task_github_issue.task_id,
			projectId: t.task.project_id,
		})
		.from(t.task_github_issue)
		.innerJoin(t.task, eq(t.task.id, t.task_github_issue.task_id))
		.where(
			and(
				sql`lower(${t.task_github_issue.repo}) = lower(${repo})`,
				eq(t.task_github_issue.number, issue.number),
			),
		);
	let changed = 0;
	for (const { taskId, projectId } of mapped) {
		const link = await linkOf(projectId);
		const ctx = link && (await actingAs(link));
		if (!ctx) continue;
		const made = await quiet.run(true, async () =>
			(await gql()).run<{ addComment: { id: string } }>(
				ctx,
				`mutation($slug: String!, $t: ID!, $text: String!) { addComment(slug: $slug, taskId: $t, text: $text) { id } }`,
				{ t: taskId, text: fromGitHub(comment) },
			),
		);
		if (!("data" in made)) {
			await recordError(
				"github",
				`${repo}#${issue.number} comment: ${made.error}`,
			);
			continue;
		}
		await db
			.insert(t.task_github_comment)
			.values({
				comment_id: made.data.addComment.id,
				repo,
				github_id: comment.id,
			})
			.onConflictDoNothing();
		changed++;
	}
	return { changed };
}
