import { createHmac, timingSafeEqual } from "node:crypto";
import { run } from "#/lib/ai/gql.server";
import { userClock } from "#/lib/ai/limits.server";
import { auth, MCP_RESOURCE } from "#/lib/auth";
import { requireEnv } from "#/lib/env";
import { parseRepo } from "#/lib/github.server";

// "Connect with GitHub": the person signs in to GitHub once, and we add the project's webhook to
// the repo for them. The GitHub token is used for this one request and never stored.

const ORIGIN = new URL(MCP_RESOURCE).origin;
const CALLBACK = `${ORIGIN}/api/github/callback`;
const STATE_TTL = 10 * 60 * 1000;

/** Both GitHub OAuth app settings are present (self-hosters may leave them out). */
export const githubConnectReady = () =>
	!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

type State = { u: string; s: string; p: string; r: string; e: number };
const sign = (data: string) =>
	createHmac("sha256", requireEnv("BETTER_AUTH_SECRET"))
		.update(`github-state:${data}`)
		.digest("base64url");
const pack = (state: State) => {
	const data = Buffer.from(JSON.stringify(state)).toString("base64url");
	return `${data}.${sign(data)}`;
};
function unpack(value: string | null): State | null {
	const [data, mac] = (value ?? "").split(".");
	if (!data || !mac) return null;
	const want = Buffer.from(sign(data));
	const got = Buffer.from(mac);
	if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
	const state = JSON.parse(Buffer.from(data, "base64url").toString()) as State;
	return state.e > Date.now() ? state : null;
}

/** Back to the project page, which shows `result` as a toast. */
const back = (slug: string, projectId: string, result: string) =>
	Response.redirect(
		`${ORIGIN}/w/${encodeURIComponent(slug)}/p/${encodeURIComponent(projectId)}?github=${result}`,
		302,
	);

async function asUser(request: Request, slug: string) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return null;
	const { id, email, name } = session.user;
	return {
		user: { id, email, name },
		slug,
		today: (await userClock(id)).today,
		edited: new Set<string>(),
		asYou: true,
	};
}

const LINK = `query($slug: String!, $p: ID!) { projectGitHub(slug: $slug, projectId: $p) { repo } }`;

/** GET /api/github/connect?slug&projectId&repo: off to GitHub to approve. */
export async function githubConnect(request: Request) {
	const q = new URL(request.url).searchParams;
	const slug = q.get("slug") ?? "";
	const projectId = q.get("projectId") ?? "";
	if (!githubConnectReady()) return new Response("Not set up", { status: 404 });
	const ctx = await asUser(request, slug);
	if (!ctx) return new Response("Sign in first", { status: 401 });
	const repo = parseRepo(q.get("repo") ?? "");
	if (!repo) return back(slug, projectId, "bad-repo");
	// only people with full access to the project may link it
	if ("error" in (await run(ctx, LINK, { p: projectId })))
		return back(slug, projectId, "denied");
	const state = pack({
		u: ctx.user.id,
		s: slug,
		p: projectId,
		r: repo,
		e: Date.now() + STATE_TTL,
	});
	const url = new URL("https://github.com/login/oauth/authorize");
	url.search = new URLSearchParams({
		client_id: requireEnv("GITHUB_CLIENT_ID"),
		redirect_uri: CALLBACK,
		scope: "admin:repo_hook",
		state,
		allow_signup: "false",
	}).toString();
	return Response.redirect(url.toString(), 302);
}

/** GET /api/github/callback?code&state: link the project and add the repo's webhook. */
export async function githubCallback(request: Request) {
	const q = new URL(request.url).searchParams;
	const state = unpack(q.get("state"));
	if (!state)
		return new Response("This link expired. Try again.", { status: 400 });
	const { s: slug, p: projectId, r: repo } = state;
	const ctx = await asUser(request, slug);
	// the signed state was made for whoever is signed in now, not someone else
	if (!ctx || ctx.user.id !== state.u)
		return new Response("Sign in first", { status: 401 });
	const code = q.get("code");
	if (!code) return back(slug, projectId, "cancelled");

	const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify({
			client_id: requireEnv("GITHUB_CLIENT_ID"),
			client_secret: requireEnv("GITHUB_CLIENT_SECRET"),
			code,
			redirect_uri: CALLBACK,
		}),
	});
	const token = (
		(await tokenRes.json().catch(() => ({}))) as {
			access_token?: string;
		}
	).access_token;
	if (!token) return back(slug, projectId, "failed");
	const gh = (path: string, method = "GET", body?: object) =>
		fetch(`https://api.github.com/repos/${repo}/hooks${path}`, {
			method,
			headers: {
				authorization: `Bearer ${token}`,
				accept: "application/vnd.github+json",
				"x-github-api-version": "2022-11-28",
				"user-agent": "Zadaci",
				...(body ? { "content-type": "application/json" } : {}),
			},
			body: body && JSON.stringify(body),
		});

	// listing the hooks proves they admin the repo before we change anything
	const list = await gh("?per_page=100");
	if (!list.ok)
		return back(
			slug,
			projectId,
			list.status === 404 || list.status === 403 ? "no-access" : "failed",
		);
	const before = await run<{ projectGitHub: { repo: string } | null }>(
		ctx,
		LINK,
		{ p: projectId },
	);
	const linked = await run<{
		connectGitHub: { webhookUrl: string; secret: string };
	}>(
		ctx,
		`mutation($slug: String!, $p: ID!, $r: String!) { connectGitHub(slug: $slug, projectId: $p, repo: $r) { webhookUrl secret } }`,
		{ p: projectId, r: repo },
	);
	if ("error" in linked) return back(slug, projectId, "denied");
	const { webhookUrl, secret } = linked.data.connectGitHub;

	// one hook per project: update ours if it's there (a new secret), add it if not
	const hooks = (await list.json()) as {
		id: number;
		config?: { url?: string };
	}[];
	const mine = hooks.find((h) => h.config?.url === webhookUrl);
	const hook = {
		active: true,
		events: ["pull_request"],
		config: {
			url: webhookUrl,
			content_type: "json",
			secret,
			insecure_ssl: "0",
		},
	};
	const saved = mine
		? await gh(`/${mine.id}`, "PATCH", hook)
		: await gh("", "POST", { name: "web", ...hook });
	if (saved.ok) return back(slug, projectId, "connected");
	// a brand-new link with no webhook behind it would only confuse: undo it
	if ("data" in before && !before.data.projectGitHub)
		await run(
			ctx,
			`mutation($slug: String!, $p: ID!) { disconnectGitHub(slug: $slug, projectId: $p) }`,
			{ p: projectId },
		);
	return back(slug, projectId, "failed");
}
