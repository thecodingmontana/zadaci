import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { openKey, sealKey } from "#/lib/ai/keys.server";
import { auth, MCP_RESOURCE } from "#/lib/auth";
import { requireEnv } from "#/lib/env";
import { webhookUrl } from "#/lib/github.server";
import { safePath } from "#/lib/next-path";

// "Connect GitHub": someone connects their GitHub account once (Settings → Connected apps, or
// from a project). We keep the token sealed like AI keys and use it only to list the repos they
// admin and add a project's webhook to one. Disconnecting deletes it and revokes it on GitHub.

const ORIGIN = new URL(MCP_RESOURCE).origin;
const CALLBACK = `${ORIGIN}/api/github/callback`;
const STATE_TTL = 10 * 60 * 1000;
// webhooks only: GitHub doesn't let this list private repos (that needs full "repo" access)
const SCOPE = "admin:repo_hook";

/**
 * The Zadaci GitHub App, when it's set up: people install it on the repos they choose (private
 * ones too), and its one webhook (/api/github/app) brings every linked repo's pull requests. Its
 * client id and secret are GITHUB_CLIENT_ID/SECRET, so "Connect GitHub" works the same way.
 * Without it, the OAuth app adds a webhook to each linked repo instead (public repos in the list).
 */
export const githubApp = () => {
	const slug = process.env.GITHUB_APP_SLUG;
	return slug && process.env.GITHUB_APP_WEBHOOK_SECRET
		? { installUrl: `https://github.com/apps/${slug}/installations/new` }
		: null;
};

/** Both GitHub OAuth app settings are present (self-hosters may leave them out). */
export const githubConnectReady = () =>
	!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

type State = { u: string; b: string; e: number };
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

/** Back to where they started, with `github=<result>` for a toast. */
function back(path: string, result: string) {
	const url = new URL(path, ORIGIN);
	url.searchParams.set("github", result);
	return Response.redirect(url.toString(), 302);
}

/** GET /api/github/connect?back=/w/…: off to GitHub to approve. */
export async function githubConnect(request: Request) {
	if (!githubConnectReady()) return new Response("Not set up", { status: 404 });
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return new Response("Sign in first", { status: 401 });
	// only a path on this site (not //elsewhere or /\elsewhere, which browsers read the same)
	const b = safePath(new URL(request.url).searchParams.get("back")) ?? "/";
	const url = new URL("https://github.com/login/oauth/authorize");
	url.search = new URLSearchParams({
		client_id: requireEnv("GITHUB_CLIENT_ID"),
		redirect_uri: CALLBACK,
		scope: SCOPE,
		state: pack({ u: session.user.id, b, e: Date.now() + STATE_TTL }),
		allow_signup: "false",
	}).toString();
	return Response.redirect(url.toString(), 302);
}

/** GET /api/github/callback?code&state: keep their (sealed) token and GitHub username. */
export async function githubCallback(request: Request) {
	const q = new URL(request.url).searchParams;
	const state = unpack(q.get("state"));
	if (!state)
		return new Response("This link expired. Try again.", { status: 400 });
	const session = await auth.api.getSession({ headers: request.headers });
	// the signed state was made for whoever is signed in now, not someone else
	if (!session || session.user.id !== state.u)
		return new Response("Sign in first", { status: 401 });
	const code = q.get("code");
	if (!code) return back(state.b, "cancelled");

	const res = await fetch("https://github.com/login/oauth/access_token", {
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
		(await res.json().catch(() => ({}))) as { access_token?: string }
	).access_token;
	if (!token) return back(state.b, "failed");
	const me = await github(token, "/user");
	if (!me.ok) return back(state.b, "failed");
	const { login } = (await me.json()) as { login: string };
	const sealed = sealKey(token, state.u, "github");
	await db
		.insert(tables.github_account)
		.values({ user_id: state.u, login, token: sealed })
		.onConflictDoUpdate({
			target: tables.github_account.user_id,
			set: { login, token: sealed, created_at: new Date() },
		});
	return back(state.b, "account");
}

const github = (token: string, path: string, method = "GET", body?: object) =>
	fetch(`https://api.github.com${path}`, {
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

/** Their connected GitHub account and token, or null. */
export async function githubAccount(userId: string) {
	const [row] = await db
		.select()
		.from(tables.github_account)
		.where(eq(tables.github_account.user_id, userId));
	const token = row && openKey(row.token, userId, "github");
	return row && token ? { login: row.login, token } : null;
}

/** GitHub turned the token down (expired, revoked, or from the old OAuth app): they reconnect. */
const refused = (res: Response) => res.status === 401 || res.status === 403;

/** Repos they can link: with the GitHub App, every repo it's installed on that they can see
 * (private too); without it, the ones they admin (so we can add a webhook), most recent first.
 * null when GitHub refuses the token, so they're asked to reconnect, not shown an empty list. */
export async function githubRepos(token: string): Promise<string[] | null> {
	if (githubApp()) return appRepos(token);
	// shortcut: the first 100 repos they can reach; typing the name still works past that
	const res = await github(
		token,
		"/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
	);
	if (refused(res)) return null;
	if (!res.ok) return [];
	const repos = (await res.json()) as {
		full_name: string;
		permissions?: { admin?: boolean };
	}[];
	return repos.filter((r) => r.permissions?.admin).map((r) => r.full_name);
}

// shortcut: the first 100 installations and 100 repos in each; more rarely matters for one person
async function appRepos(token: string) {
	const res = await github(token, "/user/installations?per_page=100");
	if (refused(res)) return null;
	if (!res.ok) return [];
	const { installations } = (await res.json()) as {
		installations: { id: number }[];
	};
	const repos: string[] = [];
	for (const { id } of installations) {
		const list = await github(
			token,
			`/user/installations/${id}/repositories?per_page=100`,
		);
		if (!list.ok) continue;
		const { repositories } = (await list.json()) as {
			repositories: { full_name: string }[];
		};
		repos.push(...repositories.map((r) => r.full_name));
	}
	return [...new Set(repos)].sort((a, b) => a.localeCompare(b));
}

/** Add the project's webhook to the repo, or give the one already there the new secret. */
export async function addWebhook(
	token: string,
	repo: string,
	url: string,
	secret: string,
): Promise<"ok" | "no-access" | "failed"> {
	const list = await github(token, `/repos/${repo}/hooks?per_page=100`);
	if (list.status === 404 || list.status === 403) return "no-access";
	if (!list.ok) return "failed";
	const hooks = (await list.json()) as {
		id: number;
		config?: { url?: string };
	}[];
	const mine = hooks.find((h) => h.config?.url === url);
	const hook = {
		active: true,
		events: ["pull_request"],
		config: { url, content_type: "json", secret, insecure_ssl: "0" },
	};
	const saved = mine
		? await github(token, `/repos/${repo}/hooks/${mine.id}`, "PATCH", hook)
		: await github(token, `/repos/${repo}/hooks`, "POST", {
				name: "web",
				...hook,
			});
	return saved.ok ? "ok" : "failed";
}

/** Take the project's webhook off the repo (best effort: they may not admin it any more). */
export async function removeWebhook(token: string, repo: string, url: string) {
	const list = await github(token, `/repos/${repo}/hooks?per_page=100`);
	if (!list.ok) return;
	const hooks = (await list.json()) as {
		id: number;
		config?: { url?: string };
	}[];
	const mine = hooks.find((h) => h.config?.url === url);
	if (mine) await github(token, `/repos/${repo}/hooks/${mine.id}`, "DELETE");
}

/** Unlink the projects they linked (webhooks off the repos), forget their GitHub account, and
 * revoke our access on GitHub. GitHub calls are best effort: the links go either way. */
export async function disconnectGitHubAccount(userId: string) {
	const account = await githubAccount(userId);
	const links = await db
		.delete(tables.project_github)
		.where(eq(tables.project_github.connected_by, userId))
		.returning({
			projectId: tables.project_github.project_id,
			repo: tables.project_github.repo,
		});
	if (account)
		for (const l of links)
			await removeWebhook(account.token, l.repo, webhookUrl(l.projectId)).catch(
				() => {},
			);
	await db
		.delete(tables.github_account)
		.where(eq(tables.github_account.user_id, userId));
	if (!account || !githubConnectReady()) return;
	const basic = Buffer.from(
		`${requireEnv("GITHUB_CLIENT_ID")}:${requireEnv("GITHUB_CLIENT_SECRET")}`,
	).toString("base64");
	await fetch(
		`https://api.github.com/applications/${requireEnv("GITHUB_CLIENT_ID")}/grant`,
		{
			method: "DELETE",
			headers: {
				authorization: `Basic ${basic}`,
				accept: "application/vnd.github+json",
				"user-agent": "Zadaci",
				"content-type": "application/json",
			},
			body: JSON.stringify({ access_token: account.token }),
		},
	).catch(() => {});
}
