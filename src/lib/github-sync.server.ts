import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { and, asc, eq, isNull, ne, notExists, sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { STATUS } from "#/db/enums";
import { userClock } from "#/lib/ai/limits.server";
import { MCP_RESOURCE } from "#/lib/auth";
import { afterRequest } from "#/lib/email.server";
import { github, githubAccount } from "#/lib/github-connect.server";

// Tasks ↔ GitHub issues, for projects linked through the Zadaci GitHub App. Zadaci → GitHub: every
// task change queues its issue to be written (after the request's changes are saved), as whoever
// linked the repo. Linking imports the repo's open issues as tasks and opens issues for open tasks.

const ORIGIN = new URL(MCP_RESOURCE).origin;
// loaded on first use: tasks.server imports this module, and gql.server builds the schema from
// tasks.server, so importing it up top would be a cycle that crashes whichever loads first
const gql = () => import("#/lib/ai/gql.server");

// writes made here (importing issues) don't queue a write back to GitHub
const quiet = new AsyncLocalStorage<true>();
const queued = new Set<string>();
const running = new Set<Promise<unknown>>();
const track = (work: Promise<unknown>) => {
	running.add(work);
	void work.finally(() => running.delete(work));
	return work;
};
/** For tests: wait for every queued GitHub write to finish. */
export const githubSyncSettled = () => Promise.allSettled([...running]);

/** After this request: write the task's issue (once per task, however many changes it had). */
export function queueGitHubSync(taskId: string) {
	if (quiet.getStore() || queued.has(taskId)) return;
	queued.add(taskId);
	afterRequest(() => {
		queued.delete(taskId);
		return track(
			syncTask(taskId).catch((error) =>
				console.error(`[github] task ${taskId}:`, (error as Error).message),
			),
		);
	});
}

/** The linked repo (through the app) and who writes to it, for a project. */
async function linkOf(projectId: string) {
	const [link] = await db
		.select({
			repo: tables.project_github.repo,
			linker: tables.project_github.connected_by,
			key: tables.project.key,
			slug: tables.workspace.slug,
		})
		.from(tables.project_github)
		.innerJoin(
			tables.project,
			eq(tables.project.id, tables.project_github.project_id),
		)
		.innerJoin(
			tables.workspace,
			eq(tables.workspace.id, tables.project.workspace_id),
		)
		.where(
			and(
				eq(tables.project_github.project_id, projectId),
				eq(tables.project_github.via_app, true),
				isNull(tables.project.deleted_at),
			),
		);
	if (!link?.linker) return null;
	const account = await githubAccount(link.linker);
	return account
		? { ...link, linker: link.linker, token: account.token }
		: null;
}

const fingerprint = (issue: object) =>
	createHash("sha1").update(JSON.stringify(issue)).digest("hex");

/** Write one task's issue: open it, change it, or close it, only if something changed. */
export async function syncTask(taskId: string): Promise<void> {
	const [task] = await db
		.select()
		.from(tables.task)
		.where(eq(tables.task.id, taskId));
	if (!task) return;
	// a subtask is a checklist line in its parent's issue
	if (task.parent_task_id) return syncTask(task.parent_task_id);
	const link = await linkOf(task.project_id);
	if (!link) return;
	const subtasks = await db
		.select({ name: tables.task.name, status: tables.task.status })
		.from(tables.task)
		.where(
			and(
				eq(tables.task.parent_task_id, task.id),
				isNull(tables.task.deleted_at),
			),
		)
		.orderBy(asc(tables.task.sort_order));
	const gone = !!task.deleted_at || !!task.archived_at;
	const done = task.status === STATUS.COMPLETED;
	const issue = {
		title: task.name,
		body: issueBody(task, subtasks, link),
		state: gone || done ? ("closed" as const) : ("open" as const),
	};
	const hash = fingerprint(issue);
	const [mapped] = await db
		.select()
		.from(tables.task_github_issue)
		.where(eq(tables.task_github_issue.task_id, task.id));
	// linked to another repo since: this one gets its own issue
	const same = mapped && mapped.repo.toLowerCase() === link.repo.toLowerCase();
	if (same && mapped.synced_hash === hash) return;
	if (!same && issue.state === "closed") return; // no issue just to close it
	const res = same
		? await github(
				link.token,
				`/repos/${mapped.repo}/issues/${mapped.number}`,
				"PATCH",
				{
					...issue,
					...(issue.state === "closed" && {
						state_reason: gone ? "not_planned" : "completed",
					}),
				},
			)
		: await github(link.token, `/repos/${link.repo}/issues`, "POST", {
				title: issue.title,
				body: issue.body,
			});
	if (!res.ok)
		throw new Error(`GitHub answered ${res.status} for ${link.repo}`);
	const { number } = (await res.json()) as { number: number };
	await remember(task.id, link.repo, number, hash);
}

const remember = (taskId: string, repo: string, number: number, hash: string) =>
	db
		.insert(tables.task_github_issue)
		.values({ task_id: taskId, repo, number, synced_hash: hash })
		.onConflictDoUpdate({
			target: tables.task_github_issue.task_id,
			set: { repo, number, synced_hash: hash, updated_at: new Date() },
		});

function issueBody(
	task: typeof tables.task.$inferSelect,
	subtasks: { name: string; status: string }[],
	link: { key: string; slug: string },
) {
	const lines = [task.description?.trim() ?? ""];
	if (subtasks.length)
		lines.push(
			`**Subtasks**\n${subtasks
				.map(
					(s) => `- [${s.status === STATUS.COMPLETED ? "x" : " "}] ${s.name}`,
				)
				.join("\n")}`,
		);
	const facts = [
		`${link.key}-${task.number}`,
		task.priority !== "none" && `Priority: ${task.priority}`,
		task.due_date && `Due: ${task.due_date.toISOString().slice(0, 10)}`,
		`[Open in Zadaci](${ORIGIN}/w/${link.slug}/p/${task.project_id}?task=${task.id})`,
	].filter(Boolean);
	lines.push(`---\n${facts.join(" · ")}`);
	return lines.filter(Boolean).join("\n\n");
}

type Issue = {
	number: number;
	title: string;
	body: string | null;
	state?: string;
	pull_request?: unknown;
};

/** Right after linking: the repo's open issues become tasks, and open tasks get issues. */
export async function syncLinkedProject(projectId: string) {
	const link = await linkOf(projectId);
	if (!link) return;
	// shortcut: the 100 most recent open issues; page through more if repos get bigger
	const res = await github(
		link.token,
		`/repos/${link.repo}/issues?state=open&per_page=100`,
	);
	if (!res.ok)
		throw new Error(`GitHub answered ${res.status} listing ${link.repo}`);
	const issues = ((await res.json()) as Issue[]).filter((i) => !i.pull_request);
	const known = new Set(
		(
			await db
				.select({ number: tables.task_github_issue.number })
				.from(tables.task_github_issue)
				.where(
					sql`lower(${tables.task_github_issue.repo}) = lower(${link.repo})`,
				)
		).map((r) => r.number),
	);
	const ctx = await actingAs(link);
	if (!ctx) return;
	for (const issue of issues.filter((i) => !known.has(i.number)))
		await importIssue(ctx, projectId, link.repo, issue);
	// shortcut: one request after another, fine for hundreds of tasks; batch past GitHub's rate limit
	const open = await db
		.select({ id: tables.task.id })
		.from(tables.task)
		.where(
			and(
				eq(tables.task.project_id, projectId),
				isNull(tables.task.parent_task_id),
				isNull(tables.task.deleted_at),
				isNull(tables.task.archived_at),
				ne(tables.task.status, STATUS.COMPLETED),
				notExists(
					db
						.select()
						.from(tables.task_github_issue)
						.where(eq(tables.task_github_issue.task_id, tables.task.id)),
				),
			),
		)
		.orderBy(asc(tables.task.number));
	for (const t of open) await syncTask(t.id);
}

/** Queue the first sync of a newly linked project. */
export function queueLinkedProjectSync(projectId: string) {
	afterRequest(() =>
		track(
			syncLinkedProject(projectId).catch((error) =>
				console.error(
					`[github] project ${projectId}:`,
					(error as Error).message,
				),
			),
		),
	);
}

/** Zadaci changes made for GitHub run as whoever linked the repo, with their rights. */
async function actingAs(link: { linker: string; slug: string }) {
	const [who] = await db
		.select({
			id: tables.user.id,
			email: tables.user.email,
			name: tables.user.name,
		})
		.from(tables.user)
		.where(eq(tables.user.id, link.linker));
	if (!who) return null;
	return {
		user: who,
		slug: link.slug,
		today: (await userClock(who.id)).today,
		edited: new Set<string>(),
		asYou: true,
	};
}
type Ctx = NonNullable<Awaited<ReturnType<typeof actingAs>>>;

/** An issue with no task yet becomes one, then gets its Zadaci link written back. */
async function importIssue(
	ctx: Ctx,
	projectId: string,
	repo: string,
	issue: Issue,
) {
	const made = await quiet.run(true, async () =>
		(await gql()).run<{ createTask: { id: string } }>(
			ctx,
			`mutation($slug: String!, $i: TaskInput!) { createTask(slug: $slug, input: $i) { id } }`,
			{
				i: {
					projectId,
					title: issue.title.slice(0, 500),
					description: descriptionOf(issue.body),
					status: issue.state === "closed" ? "completed" : "todo",
				},
			},
		),
	);
	if (!("data" in made)) return null;
	// mapped first, so writing it back (adding the Zadaci footer) edits this issue, not a new one
	await remember(made.data.createTask.id, repo, issue.number, "");
	await syncTask(made.data.createTask.id);
	return made.data.createTask.id;
}

/** The task's description inside an issue body: what's above the subtasks and Zadaci footer. */
function descriptionOf(body: string | null) {
	const text = (body ?? "")
		.replace(/\n*---\n[^\n]*Open in Zadaci[^\n]*\s*$/, "")
		.replace(/\n*\*\*Subtasks\*\*\n(?:- \[[ x]\] .*(?:\n|$))*\s*$/, "")
		.trim();
	return text ? text.slice(0, 20_000) : null;
}

export type IssueEvent = {
	action?: string;
	issue?: Issue;
	repository?: { full_name?: string };
};

/**
 * GitHub → Zadaci (the app's `issues` webhook): an issue opened, edited, closed, reopened or
 * deleted on GitHub changes its task, in every project that linked the repo through the app.
 * Our own writes come back too: those match the fingerprint we saved, and are skipped.
 */
export async function applyIssueEvent({
	action,
	issue,
	repository,
}: IssueEvent) {
	const repo = repository?.full_name;
	if (!issue || !repo || issue.pull_request) return { changed: 0 };
	const projects = await db
		.select({ id: tables.project_github.project_id })
		.from(tables.project_github)
		.where(
			and(
				eq(tables.project_github.via_app, true),
				sql`lower(${tables.project_github.repo}) = lower(${repo})`,
			),
		);
	let changed = 0;
	for (const { id: projectId } of projects) {
		const link = await linkOf(projectId);
		const ctx = link && (await actingAs(link));
		if (!link || !ctx) continue;
		const [mapped] = await db
			.select({
				taskId: tables.task_github_issue.task_id,
				hash: tables.task_github_issue.synced_hash,
			})
			.from(tables.task_github_issue)
			.innerJoin(
				tables.task,
				eq(tables.task.id, tables.task_github_issue.task_id),
			)
			.where(
				and(
					eq(tables.task.project_id, projectId),
					sql`lower(${tables.task_github_issue.repo}) = lower(${repo})`,
					eq(tables.task_github_issue.number, issue.number),
				),
			);
		if (!mapped) {
			if (action !== "opened") continue;
			// one we just opened for a task (GitHub can tell us before we saved its number)
			const ours = issue.body?.match(/\?task=([A-Za-z0-9_-]{8,32})\)/)?.[1];
			if (ours) {
				await remember(ours, repo, issue.number, "");
				continue;
			}
			if (await importIssue(ctx, projectId, link.repo, issue)) changed++;
			continue;
		}
		const seen = fingerprint({
			title: issue.title,
			body: issue.body ?? "",
			state: issue.state,
		});
		if (seen === mapped.hash) continue; // our own write, coming back
		const write = (query: string, variables: Record<string, unknown>) =>
			quiet.run(true, async () =>
				(await gql()).run(ctx, query, { id: mapped.taskId, ...variables }),
			);
		const PATCH = `mutation($slug: String!, $id: ID!, $p: TaskPatch!) { updateTask(slug: $slug, id: $id, patch: $p) { id } }`;
		const done =
			action === "deleted"
				? await write(
						`mutation($slug: String!, $ids: [ID!]!) { deleteTasks(slug: $slug, ids: $ids) }`,
						{ ids: [mapped.taskId] },
					)
				: action === "closed"
					? await write(PATCH, { p: { status: "completed" } })
					: action === "reopened"
						? await write(PATCH, { p: { status: "todo" } })
						: action === "edited"
							? await write(PATCH, {
									p: {
										title: issue.title.slice(0, 500),
										description: descriptionOf(issue.body),
									},
								})
							: null;
		if (!done) continue;
		if ("error" in done) {
			console.error(`[github] ${repo}#${issue.number}: ${done.error}`);
			continue;
		}
		// what GitHub has now is in sync: the next change on either side is the real one
		await remember(mapped.taskId, link.repo, issue.number, seen);
		changed++;
	}
	return { changed };
}
