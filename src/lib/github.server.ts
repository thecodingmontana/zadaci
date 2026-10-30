import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, tables } from "#/db";
import { STATUS } from "#/db/enums";
import { run } from "#/lib/ai/gql.server";
import { userClock } from "#/lib/ai/limits.server";
import { requireEnv } from "#/lib/env";
import { announceChange } from "#/lib/realtime.server";

// GitHub → Zadaci: a repo's webhook tells us about its pull requests. A PR that mentions a task's
// key (PSA-4) in its title, branch or description shows on that task; merging it completes the task.

/** The webhook secret for a link: derived, never stored, and new whenever the link is remade. */
export const githubSecret = (projectId: string, nonce: string) =>
	createHmac("sha256", requireEnv("BETTER_AUTH_SECRET"))
		.update(`github:${projectId}:${nonce}`)
		.digest("hex");

/** GitHub's X-Hub-Signature-256 for this body and secret, compared in constant time. */
export function signedByGitHub(
	body: string,
	header: string | null,
	secret: string,
) {
	if (!header?.startsWith("sha256=")) return false;
	const want = Buffer.from(
		`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
	);
	const got = Buffer.from(header);
	return want.length === got.length && timingSafeEqual(want, got);
}

/** Task numbers a text mentions for this project's key: "PSA-4", "psa-4-login-page" → [4]. */
export function taskNumbers(
	key: string,
	...texts: (string | null | undefined)[]
) {
	const re = new RegExp(`(?<![A-Za-z0-9])${key}-(\\d{1,6})(?![A-Za-z0-9])`, "gi");
	const found = new Set<number>();
	for (const t of texts)
		for (const m of (t ?? "").matchAll(re)) found.add(Number(m[1]));
	return [...found];
}

type PullRequestEvent = {
	action?: string;
	repository?: { full_name?: string };
	pull_request?: {
		number: number;
		title: string;
		body: string | null;
		html_url: string;
		state: string;
		merged?: boolean;
		head?: { ref?: string };
	};
};

/** POST /api/github/<projectId>: one delivery from GitHub. */
export async function githubWebhook(projectId: string, request: Request) {
	const [link] = await db
		.select({
			repo: tables.project_github.repo,
			nonce: tables.project_github.nonce,
			connectedBy: tables.project_github.connected_by,
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
				isNull(tables.project.deleted_at),
			),
		);
	if (!link) return new Response("Not connected", { status: 404 });
	const body = await request.text();
	if (
		!signedByGitHub(
			body,
			request.headers.get("x-hub-signature-256"),
			githubSecret(projectId, link.nonce),
		)
	)
		return new Response("Bad signature", { status: 401 });

	const event = request.headers.get("x-github-event");
	if (event === "ping") return Response.json({ ok: true });
	if (event !== "pull_request") return new Response(null, { status: 204 });
	const {
		action,
		repository,
		pull_request: pr,
	} = JSON.parse(body) as PullRequestEvent;
	if (!pr || repository?.full_name?.toLowerCase() !== link.repo.toLowerCase())
		return new Response("Not this project's repo", { status: 400 });

	const numbers = taskNumbers(link.key, pr.title, pr.head?.ref, pr.body);
	if (!numbers.length) return Response.json({ linked: 0 });
	const tasks = await db
		.select({ id: tables.task.id, status: tables.task.status })
		.from(tables.task)
		.where(
			and(
				eq(tables.task.project_id, projectId),
				inArray(tables.task.number, numbers),
				isNull(tables.task.deleted_at),
			),
		);
	const merged = action === "closed" && !!pr.merged;
	const state =
		merged || pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";
	for (const t of tasks)
		await db
			.insert(tables.task_github_pr)
			.values({
				task_id: t.id,
				repo: link.repo,
				number: pr.number,
				title: pr.title.slice(0, 300),
				url: pr.html_url,
				state,
			})
			.onConflictDoUpdate({
				target: [
					tables.task_github_pr.task_id,
					tables.task_github_pr.repo,
					tables.task_github_pr.number,
				],
				set: {
					title: pr.title.slice(0, 300),
					url: pr.html_url,
					state,
					updated_at: new Date(),
				},
			});

	// merged: complete the tasks the way a person would (repeats, notifications, activity), as the
	// person who connected the repo, with their rights
	let completed = 0;
	const open = tasks.filter((t) => t.status !== STATUS.COMPLETED);
	if (merged && open.length && link.connectedBy) {
		const [who] = await db
			.select({
				id: tables.user.id,
				email: tables.user.email,
				name: tables.user.name,
			})
			.from(tables.user)
			.where(eq(tables.user.id, link.connectedBy));
		if (who) {
			const ctx = {
				user: who,
				slug: link.slug,
				today: (await userClock(who.id)).today,
				edited: new Set<string>(),
				asYou: true,
			};
			for (const t of open) {
				const res = await run(
					ctx,
					`mutation($slug: String!, $id: ID!) { updateTask(slug: $slug, id: $id, patch: { status: "completed" }) { id } }`,
					{ id: t.id },
				);
				if ("data" in res) completed++;
			}
		}
	}
	announceChange(link.slug);
	return Response.json({ linked: tasks.length, completed });
}
