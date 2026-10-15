import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;

test("anonymous and unsecured users get no data", async () => {
	assert.equal(code(await gql(null, "{ workspaces { id } }")), "UNAUTHENTICATED");
	const unsecured = await makeUser("unsecured", false);
	assert.equal(code(await gql(unsecured, "{ workspaces { id } }")), "UNAUTHENTICATED");
});

test("outsiders can't read a workspace", async () => {
	const owner = await makeUser("owner");
	const outsider = await makeUser("outsider");
	const { slug } = await makeWorkspace(owner);
	const res = await gql(outsider, `query($s: String!) { workspace(slug: $s) { id } }`, { s: slug });
	assert.equal(res.data?.workspace, null);
});

test("only owners and admins change workspace settings or delete projects", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const edit = await gql(member, `mutation($s: String!) { updateWorkspace(slug: $s, input: { name: "x" }) { id } }`, { s: slug });
	assert.equal(code(edit), "FORBIDDEN");
	const ws = await gql(member, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug });
	const projectId = ws.data?.workspace.projects[0].id;
	const del = await gql(member, `mutation($s: String!, $p: ID!) { deleteProject(slug: $s, projectId: $p) }`, { s: slug, p: projectId });
	assert.equal(code(del), "FORBIDDEN");
});

test("Google ID-token sign-in is disabled, so it can't skip two-step verification", async () => {
	const { auth } = await import("#/lib/auth");
	const res = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/social", {
			method: "POST",
			headers: { "content-type": "application/json", origin: "http://localhost:3000" },
			body: JSON.stringify({ provider: "google", idToken: { token: "not-a-real-token" } }),
		}),
	);
	const body = (await res.json()) as { code?: string };
	assert.equal(body.code, "ID_TOKEN_NOT_SUPPORTED");
});
