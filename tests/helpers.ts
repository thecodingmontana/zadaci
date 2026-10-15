import { createHmac } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, driver, tables } from "#/db";
import { yoga } from "#/graphql/yoga.server";
import { auth } from "#/lib/auth";

// Integration helpers: run GraphQL and better-auth in-process against the dev database.

const created: string[] = [];
const secret = process.env.BETTER_AUTH_SECRET ?? "";
const sign = (value: string) =>
	encodeURIComponent(`${value}.${createHmac("sha256", secret).update(value).digest("base64")}`);

export type TestUser = { id: string; email: string; cookie: string };

/** A signed-in user; `secured` gives them an authenticator app so the app lets them in. */
export async function makeUser(label: string, secured = true): Promise<TestUser> {
	const ctx = await auth.$context;
	const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.zadaci`;
	const user = await ctx.internalAdapter.createUser({ email, name: label, emailVerified: true }, { method: "admin" });
	created.push(user.id);
	if (secured) await ctx.internalAdapter.updateUser(user.id, { twoFactorEnabled: true });
	const session = await ctx.internalAdapter.createSession(user.id, false);
	return { id: user.id, email, cookie: `better-auth.session_token=${sign(session.token)}` };
}

export async function gql(user: TestUser | null, query: string, variables: Record<string, unknown> = {}) {
	const res = await yoga.fetch(
		new Request("http://test/api/graphql", {
			method: "POST",
			headers: { "content-type": "application/json", ...(user ? { cookie: user.cookie } : {}) },
			body: JSON.stringify({ query, variables }),
		}),
	);
	return (await res.json()) as { data?: Record<string, any>; errors?: { message: string; extensions?: { code?: string } }[] };
}

/** Creates a workspace owned by `owner` (with one starter project) and returns its slug and invite code. */
export async function makeWorkspace(owner: TestUser) {
	const slug = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	const res = await gql(owner, `mutation($i: OnboardingInput!) { completeOnboarding(input: $i) { slug inviteCode } }`, {
		i: {
			useCase: "product",
			name: "Test",
			slug,
			defaultView: "board",
			teamSize: "2-10",
			projectName: "Alpha",
			templateId: "web",
			invites: [],
		},
	});
	if (!res.data) throw new Error(JSON.stringify(res.errors));
	return res.data.completeOnboarding as { slug: string; inviteCode: string };
}

export async function join(user: TestUser, code: string) {
	return gql(user, `mutation($c: String!) { joinWorkspace(code: $c) { id } }`, { c: code });
}

export async function cleanup() {
	if (created.length) {
		await db.delete(tables.workspace).where(inArray(tables.workspace.user_id, created));
		for (const id of created) await db.delete(tables.user).where(eq(tables.user.id, id));
	}
	await driver.end();
}
