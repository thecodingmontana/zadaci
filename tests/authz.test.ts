import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;

test("anonymous users get no data; two-step is optional", async () => {
	assert.equal(code(await gql(null, "{ workspaces { id } }")), "UNAUTHENTICATED");
	const plain = await makeUser("plain", false);
	assert.equal((await gql(plain, "{ workspaces { id } }")).errors, undefined);
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

test("a removed member can't rejoin with the old invite link", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const ws = await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug });
	const memberId = ws.data?.workspace.members.find((m: { isMe: boolean }) => !m.isMe).id;
	await gql(owner, `mutation($s: String!, $m: ID!) { removeMember(slug: $s, memberId: $m) }`, { s: slug, m: memberId });
	const rejoin = await join(member, inviteCode);
	assert.ok(rejoin.errors?.length, "old invite code should no longer work");
	const after = await gql(member, `query($s: String!) { workspace(slug: $s) { id } }`, { s: slug });
	assert.equal(after.data?.workspace, null);
});

test("duplicating a project respects 'Members can create projects'", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	await gql(owner, `mutation($s: String!) { updateWorkspace(slug: $s, input: { settings: { permCreate: false } }) { id } }`, { s: slug });
	const ws = await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug });
	const p = ws.data?.workspace.projects[0].id;
	const DUP = `mutation($s: String!, $p: ID!) { duplicateProject(slug: $s, projectId: $p) { id } }`;
	assert.equal(code(await gql(member, DUP, { s: slug, p })), "FORBIDDEN");
	await gql(owner, `mutation($s: String!) { updateWorkspace(slug: $s, input: { settings: { permCreate: true } }) { id } }`, { s: slug });
	assert.equal(code(await gql(member, DUP, { s: slug, p })), "FORBIDDEN", "commenting on a project isn't enough to copy it");
	const KEYS = `query($s: String!) { workspace(slug: $s) { projects { key } } }`;
	assert.ok((await gql(owner, DUP, { s: slug, p })).data?.duplicateProject.id, "owners can still duplicate");
	const keys = (await gql(owner, KEYS, { s: slug })).data?.workspace.projects.map((x: { key: string }) => x.key);
	assert.equal(new Set(keys).size, keys.length, "the copy gets its own key");
});

test("joining twice at the same moment creates one membership", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	const results = await Promise.all(Array.from({ length: 10 }, () => join(member, inviteCode)));
	assert.ok(results.every((r) => !r.errors), JSON.stringify(results.map((r) => r.errors)));
	const ws = await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id } } }`, { s: slug });
	assert.equal(ws.data?.workspace.members.length, 2);
});

test("inviting the same email twice keeps one pending invite", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const INVITE = `mutation($s: String!) { inviteMembers(slug: $s, emails: ["Pat@Acme.dev"], role: "member") { id } }`;
	await gql(owner, INVITE, { s: slug });
	await gql(owner, INVITE, { s: slug });
	const ws = await gql(owner, `query($s: String!) { workspace(slug: $s) { invites { email } } }`, { s: slug });
	assert.deepEqual(ws.data?.workspace.invites, [{ email: "pat@acme.dev" }]);
});

test("only admins see the workspace link; an emailed invite works only for its address, until it expires", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const guest = await makeUser("guest");
	const stranger = await makeUser("stranger");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const CODE = `query($s: String!) { workspace(slug: $s) { inviteCode } }`;
	assert.equal((await gql(member, CODE, { s: slug })).data?.workspace.inviteCode, "", "members can't pass the member link on");

	const INVITE = `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`;
	const [invite] = (await gql(owner, INVITE, { s: slug, e: [guest.email] })).data?.inviteMembers;
	assert.equal(code(await join(stranger, invite.id)), "BAD_USER_INPUT", "a forwarded invite doesn't let someone else in");
	assert.ok((await join(guest, invite.id)).data?.joinWorkspace);
	const ROLE = `query($s: String!) { workspace(slug: $s) { role } }`;
	assert.equal((await gql(guest, ROLE, { s: slug })).data?.workspace.role, "guest");

	// an expired admin invite no longer decides the role, and its link stops working
	const late = await makeUser("late");
	const [old] = (await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "moderator") { id } }`, { s: slug, e: [late.email] })).data?.inviteMembers;
	await db.update(tables.workspace_invite_request).set({ expires_at: new Date(Date.now() - 1000) }).where(eq(tables.workspace_invite_request.id, old.id));
	assert.equal(code(await join(late, old.id)), "BAD_USER_INPUT");
	await join(late, inviteCode);
	assert.equal((await gql(late, ROLE, { s: slug })).data?.workspace.role, "member");
});

test("favorites are per user", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const Q = `query($s: String!) { workspace(slug: $s) { projects { id isFavorite } } }`;
	const p = (await gql(owner, Q, { s: slug })).data?.workspace.projects[0].id;
	await gql(owner, `mutation($s: String!, $p: ID!) { toggleFavorite(slug: $s, projectId: $p) }`, { s: slug, p });
	assert.equal((await gql(owner, Q, { s: slug })).data?.workspace.projects[0].isFavorite, true);
	assert.equal((await gql(member, Q, { s: slug })).data?.workspace.projects[0].isFavorite, false);
});
