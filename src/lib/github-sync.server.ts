import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db, tables } from "#/db";
import { STATUS } from "#/db/enums";
import { userClock } from "#/lib/ai/limits.server";
import { MCP_RESOURCE } from "#/lib/auth";
import { afterRequest } from "#/lib/email.server";
import { ensureBoard, syncCard } from "#/lib/github-board.server";
import { github, githubAccount } from "#/lib/github-connect.server";
import { recordError } from "#/lib/ops.server";

// Tasks ↔ GitHub issues, for projects linked through the Zadaci GitHub App. Zadaci → GitHub: every
// task change queues its issue to be written (after the request's changes are saved), as whoever
// linked the repo. Linking imports the repo's open issues as tasks and gives every task an issue.

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
				recordError("github", `task ${taskId}: ${(error as Error).message}`),
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
			name: tables.project.title,
			board: tables.project_github.board,
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
		? {
				...link,
				projectId,
				linker: link.linker,
				token: account.token,
				login: account.login,
			}
		: null;
}

/** GitHub said no: keep its reason (a status alone hides rate limits and missing permissions). */
async function refused(res: Response, what: string) {
	const reason = ((await res.json().catch(() => ({}))) as { message?: string })
		.message;
	return new Error(
		`GitHub answered ${res.status} for ${what}${reason ? `: ${reason.slice(0, 200)}` : ""}`,
	);
}

const fingerprint = (issue: object) =>
	createHash("sha1").update(JSON.stringify(issue)).digest("hex");

/** Write one task's issue: open it, change it, or close it, only if something changed. True when
 * it wrote to GitHub. */
type Link = NonNullable<Awaited<ReturnType<typeof linkOf>>>;

export async function syncTask(taskId: string, known?: Link): Promise<boolean> {
	const [task] = await db
		.select()
		.from(tables.task)
		.where(eq(tables.task.id, taskId));
	if (!task) return false;
	// a subtask is a checklist line in its parent's issue
	if (task.parent_task_id) return syncTask(task.parent_task_id, known);
	// a project's sync passes its link in, rather than loading it (and the token) once per task
	const link =
		known?.projectId === task.project_id
			? known
			: await linkOf(task.project_id);
	if (!link) return false;
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
	const same =
		mapped?.number != null &&
		mapped.repo.toLowerCase() === link.repo.toLowerCase();
	if (!same && gone) return false; // a deleted or archived task gets no issue
	const wrote = !same || mapped.synced_hash !== hash;
	let number = same ? (mapped.number as number) : 0;
	if (!same) {
		// another sync is opening it right now (a quick second edit, the hourly run)
		if (!(await claimIssue(task.id, link.repo))) return false;
		const res = await github(link.token, `/repos/${link.repo}/issues`, "POST", {
			title: issue.title,
			body: issue.body,
		});
		if (!res.ok) {
			await releaseIssue(task.id);
			throw await refused(res, `${link.repo} (${link.key}-${task.number})`);
		}
		number = ((await res.json()) as { number: number }).number;
		// saved before anything else, so GitHub's "opened" event finds it is ours
		await remember(
			task.id,
			link.repo,
			number,
			fingerprint({ ...issue, state: "open" }),
		);
	}
	// GitHub opens every new issue: a completed task's is closed straight after
	if ((same && wrote) || (!same && issue.state === "closed")) {
		const res = await github(
			link.token,
			`/repos/${link.repo}/issues/${number}`,
			"PATCH",
			{
				...issue,
				...(issue.state === "closed" && {
					state_reason: gone ? "not_planned" : "completed",
				}),
			},
		);
		if (!res.ok)
			throw await refused(res, `${link.repo} (${link.key}-${task.number})`);
	}
	if (wrote) await remember(task.id, link.repo, number, hash);
	if (!link.board) return wrote;
	// the issue's card on the project's board follows the task's status
	const carded = await syncCard(
		link.token,
		link.board,
		{
			task_id: task.id,
			repo: link.repo,
			number,
			card: same ? mapped.card : null,
			card_status: same ? mapped.card_status : null,
		},
		task.status,
		gone,
	);
	return wrote || carded;
}

const CLAIM_MS = 5 * 60_000;

/** Claim a task before opening its issue, so of two syncs at once only one opens it: the mapping
 * row goes in first, without a number. One a crashed sync left behind can be claimed again after
 * 5 minutes. True for the sync that got it. */
async function claimIssue(taskId: string, repo: string) {
	const t = tables.task_github_issue;
	const stale = new Date(Date.now() - CLAIM_MS);
	const claimed = await db
		.insert(t)
		.values({ task_id: taskId, repo, number: null, synced_hash: "" })
		.onConflictDoUpdate({
			target: t.task_id,
			set: {
				repo,
				number: null,
				synced_hash: "",
				card: null,
				card_status: null,
				updated_at: new Date(),
			},
			// linked to another repo since, or a claim that ran out
			setWhere: sql`lower(${t.repo}) <> lower(${repo}) or (${t.number} is null and ${t.updated_at} < ${stale})`,
		})
		.returning({ id: t.task_id });
	return claimed.length > 0;
}

/** GitHub refused to open it: let the next sync try. */
const releaseIssue = (taskId: string) =>
	db
		.delete(tables.task_github_issue)
		.where(
			and(
				eq(tables.task_github_issue.task_id, taskId),
				isNull(tables.task_github_issue.number),
			),
		);

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
	user?: { login?: string } | null;
};

/** Right after linking: the repo's open issues become tasks, and its tasks get issues (closed for done ones). */
const LEASE = sql`now() + interval '10 minutes'`;

/** How long a sync may run: Vercel stops a function at 300 s, so stop starting new work at 240 s
 * and let the next run carry on from where this one stopped (tests set GITHUB_SYNC_BUDGET_MS). */
export const syncDeadline = () =>
	Date.now() + Number(process.env.GITHUB_SYNC_BUDGET_MS ?? 240_000);

/** One sync of a project at a time (linking, Sync now and the hourly run can overlap, and two at
 * once would import the same issues twice): claim the project, and skip it if another sync has. */
export async function syncLinkedProject(
	projectId: string,
	deadline = syncDeadline(),
): Promise<"done" | "stopped" | "busy"> {
	const pg = tables.project_github;
	const [claimed] = await db
		.update(pg)
		.set({ sync_until: LEASE })
		.where(
			and(
				eq(pg.project_id, projectId),
				sql`(${pg.sync_until} is null or ${pg.sync_until} < now())`,
			),
		)
		.returning({ id: pg.project_id });
	if (!claimed) return "busy";
	try {
		return await syncLinkedProjectNow(projectId, deadline);
	} finally {
		await db
			.update(pg)
			.set({ sync_until: null })
			.where(eq(pg.project_id, projectId));
	}
}

async function syncLinkedProjectNow(projectId: string, deadline: number) {
	const link = await linkOf(projectId);
	if (!link) return "done";
	// shortcut: the 100 most recent open issues; page through more if repos get bigger
	const res = await github(
		link.token,
		`/repos/${link.repo}/issues?state=open&per_page=100`,
	);
	if (!res.ok) throw await refused(res, `listing ${link.repo}'s issues`);
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
	if (!ctx) return "done";
	// the repo's board, before the tasks below put their issues on it
	const board = await ensureBoard(link);
	// one failure (a rate limit, say) doesn't stop the rest; running it again picks up what's left
	let stopped = false;
	const each = async (what: string, work: () => Promise<unknown>) => {
		if (stopped || Date.now() > deadline) {
			stopped = true;
			return;
		}
		try {
			if (await work()) await pause();
		} catch (error) {
			await recordError("github", `${what}: ${(error as Error).message}`);
		}
	};
	for (const issue of issues.filter((i) => !known.has(i.number)))
		await each(`${link.repo}#${issue.number}`, () =>
			importIssue(ctx, projectId, link.repo, issue),
		);
	// every task, not only those without an issue: an earlier sync that stopped part-way gets
	// finished (syncTask writes nothing when GitHub already matches). Deleted and archived ones
	// too while they still have an issue: if closing it failed once, this closes it
	const tasks = await db
		.select({ id: tables.task.id })
		.from(tables.task)
		.leftJoin(
			tables.task_github_issue,
			eq(tables.task_github_issue.task_id, tables.task.id),
		)
		.where(
			and(
				eq(tables.task.project_id, projectId),
				isNull(tables.task.parent_task_id),
				or(
					and(isNull(tables.task.deleted_at), isNull(tables.task.archived_at)),
					sql`${tables.task_github_issue.task_id} is not null`,
				),
			),
		)
		.orderBy(asc(tables.task.number));
	const synced = { ...link, board };
	for (const t of tasks)
		await each(`task ${t.id}`, () => syncTask(t.id, synced));
	return stopped ? "stopped" : "done";
}

// GitHub asks for about a second between writes that create content, or it answers 403 (its
// secondary rate limit). shortcut: a project with hundreds of tasks takes minutes; queue it if so
// (tests set GITHUB_SYNC_PAUSE_MS=0)
const pause = () =>
	new Promise((r) =>
		setTimeout(r, Number(process.env.GITHUB_SYNC_PAUSE_MS ?? 1000)),
	);

/** The hourly job's repair pass: finishes whatever a refused or interrupted write left behind,
 * so nobody has to press Sync now. Unchanged tasks cost no GitHub calls. */
export async function syncAllLinkedProjects(deadline = syncDeadline()) {
	const links = await db
		.select({ id: tables.project_github.project_id })
		.from(tables.project_github)
		.where(eq(tables.project_github.via_app, true));
	let unfinished = 0;
	for (const { id } of links) {
		const outcome = await syncLinkedProject(id, deadline).catch(
			async (error) => {
				await recordError(
					"github",
					`project ${id}: ${(error as Error).message}`,
				);
				return "done" as const;
			},
		);
		if (outcome === "stopped" || Date.now() > deadline) unfinished++;
	}
	// the admin page shows this: a backlog bigger than one run carries on next hour
	return { linked: links.length, unfinished };
}

/** Queue the first sync of a newly linked project. */
export function queueLinkedProjectSync(projectId: string) {
	afterRequest(() =>
		track(
			syncLinkedProject(projectId).catch((error) =>
				recordError(
					"github",
					`project ${projectId}: ${(error as Error).message}`,
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
			// one we just opened for a task (GitHub can tell us before we saved its number). The
			// body is anyone's text, so only trust it from the linker, for a task of this project
			// that has no issue yet: never move an existing link to someone else's issue.
			const ours = issue.body?.match(/\?task=([A-Za-z0-9_-]{8,32})\)/)?.[1];
			const byLinker =
				issue.user?.login?.toLowerCase() === link.login.toLowerCase();
			if (ours && byLinker) {
				const [task] = await db
					.select({ id: tables.task.id })
					.from(tables.task)
					.where(
						and(
							eq(tables.task.id, ours),
							eq(tables.task.project_id, projectId),
						),
					);
				if (task)
					await db
						.insert(tables.task_github_issue)
						.values({
							task_id: task.id,
							repo,
							number: issue.number,
							synced_hash: "",
						})
						.onConflictDoNothing();
				continue;
			}
			if (await importIssue(ctx, projectId, link.repo, issue)) changed++;
			continue;
		}
		// events can arrive out of order or be redelivered: act on the issue as it is now on
		// GitHub, not as this event says it was (else "closed, reopened" arriving reversed leaves
		// the task done while the issue is open, and the saved fingerprint hides it for good)
		let current = issue;
		if (action !== "deleted") {
			const res = await github(
				link.token,
				`/repos/${repo}/issues/${issue.number}`,
			);
			const now = res.ok ? ((await res.json()) as Partial<Issue>) : null;
			if (now?.state && now.title !== undefined) current = { ...issue, ...now };
		}
		const seen = fingerprint({
			title: current.title,
			body: current.body ?? "",
			state: current.state,
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
				: action === "closed" || action === "reopened"
					? await write(PATCH, {
							p: { status: current.state === "closed" ? "completed" : "todo" },
						})
					: action === "edited"
						? await write(PATCH, {
								p: {
									title: current.title.slice(0, 500),
									description: descriptionOf(current.body),
								},
							})
						: null;
		if (!done) continue;
		if ("error" in done) {
			await recordError("github", `${repo}#${issue.number}: ${done.error}`);
			continue;
		}
		// what GitHub has now is in sync: the next change on either side is the real one
		await remember(mapped.taskId, link.repo, issue.number, seen);
		changed++;
	}
	return { changed };
}
