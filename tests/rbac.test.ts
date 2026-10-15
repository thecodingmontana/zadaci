import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, tables } from "#/db";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const INVITE = `mutation($s: String!, $e: [String!]!, $r: String!) { inviteMembers(slug: $s, emails: $e, role: $r) { id } }`;
const WS = `query($s: String!) { workspace(slug: $s) { role members { id isMe } projects { id title } } }`;

/** A workspace with two projects and a guest who was invited by email. */
async function withGuest() {
	const owner = await makeUser("owner");
	const guest = await makeUser("guest");
	const { slug, inviteCode } = await makeWorkspace(owner);
	const first = (await gql(owner, WS, { s: slug })).data?.workspace.projects[0];
	await gql(owner, `mutation($s: String!, $p: ID!) { duplicateProject(slug: $s, projectId: $p) { id } }`, { s: slug, p: first.id });
	await gql(owner, INVITE, { s: slug, e: [guest.email], r: "guest" });
	await join(guest, inviteCode);
	const ws = (await gql(guest, WS, { s: slug })).data?.workspace;
	return { owner, guest, slug, ws, first };
}

async function addToProject(user: TestUser, slug: string, projectId: string) {
	const me = (await gql(user, WS, { s: slug })).data?.workspace.members.find((m: { isMe: boolean }) => m.isMe);
	await db.insert(tables.project_members).values({ project_id: projectId, member_id: me.id });
}

test("guests only see and open projects they were added to", async () => {
	const { owner, guest, slug, ws, first } = await withGuest();
	assert.equal(ws.role, "guest");
	assert.equal(ws.projects.length, 0, "no projects until added");

	await addToProject(guest, slug, first.id);
	const after = (await gql(guest, WS, { s: slug })).data?.workspace;
	assert.deepEqual(after.projects.map((p: { id: string }) => p.id), [first.id]);

	const search = await gql(guest, `query($s: String!) { search(slug: $s, q: "Alpha") { projects { id } } }`, { s: slug });
	assert.deepEqual(search.data?.search.projects.map((p: { id: string }) => p.id), [first.id], "the copy stays hidden");

	const all = (await gql(owner, WS, { s: slug })).data?.workspace.projects;
	const hidden = all.find((p: { id: string }) => p.id !== first.id);
	const fav = await gql(guest, `mutation($s: String!, $p: ID!) { toggleFavorite(slug: $s, projectId: $p) }`, { s: slug, p: hidden.id });
	assert.match(fav.errors?.[0]?.message ?? "", /not found/i, "a hidden project looks like it doesn't exist");
});

test("guests can't change projects, even ones they're on", async () => {
	const { guest, slug, first } = await withGuest();
	await addToProject(guest, slug, first.id);
	const vars = { s: slug, p: first.id };
	assert.equal(code(await gql(guest, `mutation($s: String!, $p: ID!) { renameProject(slug: $s, projectId: $p, title: "x") { id } }`, vars)), "FORBIDDEN");
	assert.equal(code(await gql(guest, `mutation($s: String!, $p: ID!) { archiveProject(slug: $s, projectId: $p, archived: true) { id } }`, vars)), "FORBIDDEN");
	assert.equal(code(await gql(guest, `mutation($s: String!, $p: ID!) { duplicateProject(slug: $s, projectId: $p) { id } }`, vars)), "FORBIDDEN");
});

test("guests don't see activity from projects they aren't on", async () => {
	const { owner, guest, slug, first } = await withGuest();
	await gql(owner, `mutation($s: String!, $p: ID!) { renameProject(slug: $s, projectId: $p, title: "Renamed") { id } }`, { s: slug, p: first.id });
	const feed = (await gql(guest, `query($s: String!) { workspace(slug: $s) { activity { verb } } }`, { s: slug })).data?.workspace.activity;
	const verbs = feed.map((a: { verb: string }) => a.verb);
	assert.ok(!verbs.includes("renamed project"), "project events are hidden");
	assert.ok(verbs.includes("joined the workspace"), "workspace events still show");
});

test("members invite guests only when the workspace allows it, and never admins", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	assert.ok((await gql(member, INVITE, { s: slug, e: ["g1@example.com"], r: "guest" })).data, "allowed by default");
	assert.equal(code(await gql(member, INVITE, { s: slug, e: ["m1@example.com"], r: "member" })), "FORBIDDEN");
	await gql(owner, `mutation($s: String!) { updateWorkspace(slug: $s, input: { settings: { permGuests: false } }) { id } }`, { s: slug });
	assert.equal(code(await gql(member, INVITE, { s: slug, e: ["g2@example.com"], r: "guest" })), "FORBIDDEN");
});

test("only the owner can delete the workspace", async () => {
	const owner = await makeUser("owner");
	const admin = await makeUser("admin");
	const { slug } = await makeWorkspace(owner);
	await gql(owner, INVITE, { s: slug, e: [admin.email], r: "moderator" });
	const { inviteCode } = (await gql(owner, `query($s: String!) { workspace(slug: $s) { inviteCode } }`, { s: slug })).data?.workspace;
	await join(admin, inviteCode);
	assert.equal(code(await gql(admin, `mutation($s: String!) { deleteWorkspace(slug: $s) }`, { s: slug })), "FORBIDDEN");
});
