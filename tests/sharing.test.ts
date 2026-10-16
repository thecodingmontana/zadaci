import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const WS = `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id myAccess access } } }`;
const SHARE = `mutation($s: String!, $p: ID!, $m: ID!, $r: String!) { shareProject(slug: $s, projectId: $p, memberId: $m, permission: $r) }`;
const ACCESS = `mutation($s: String!, $p: ID!, $a: String!) { setProjectAccess(slug: $s, projectId: $p, access: $a) { id } }`;
const RENAME = `mutation($s: String!, $p: ID!) { renameProject(slug: $s, projectId: $p, title: "Renamed") { id } }`;

/** Owner with one project (they lead it) and a member who joined by link. */
async function setup() {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const ws = (await gql(owner, WS, { s: slug })).data?.workspace;
	const projectId = ws.projects[0].id;
	const memberId = ws.members.find((m: { isMe: boolean }) => !m.isMe).id;
	const ownerId = ws.members.find((m: { isMe: boolean }) => m.isMe).id;
	return { owner, member, slug, projectId, memberId, ownerId };
}

test("on a workspace project, people who aren't on it can view and comment only", async () => {
	const { member, slug, projectId } = await setup();
	const ws = (await gql(member, WS, { s: slug })).data?.workspace;
	assert.equal(ws.projects[0].myAccess, "comment");
	assert.equal(code(await gql(member, RENAME, { s: slug, p: projectId })), "FORBIDDEN");
});

test("private projects disappear until shared, and the shared right is enforced", async () => {
	const { owner, member, slug, projectId, memberId } = await setup();
	await gql(owner, ACCESS, { s: slug, p: projectId, a: "private" });
	assert.equal((await gql(member, WS, { s: slug })).data?.workspace.projects.length, 0);

	await gql(owner, SHARE, { s: slug, p: projectId, m: memberId, r: "view" });
	const seen = (await gql(member, WS, { s: slug })).data?.workspace.projects;
	assert.deepEqual(seen.map((p: { myAccess: string }) => p.myAccess), ["view"]);
	assert.equal(code(await gql(member, RENAME, { s: slug, p: projectId })), "FORBIDDEN");

	await gql(owner, SHARE, { s: slug, p: projectId, m: memberId, r: "edit" });
	assert.ok((await gql(member, RENAME, { s: slug, p: projectId })).data, "edit lets them rename");
	// but only full access manages sharing
	assert.equal(code(await gql(member, ACCESS, { s: slug, p: projectId, a: "workspace" })), "FORBIDDEN");
});

test("the lead keeps full access and can't be removed", async () => {
	const { owner, slug, projectId, ownerId } = await setup();
	const res = await gql(owner, `mutation($s: String!, $p: ID!, $m: ID!) { unshareProject(slug: $s, projectId: $p, memberId: $m) }`, {
		s: slug,
		p: projectId,
		m: ownerId,
	});
	assert.match(res.errors?.[0]?.message ?? "", /lead/);
	const members = (await gql(owner, `query($s: String!, $p: ID!) { workspace(slug: $s) { project(id: $p) { members { isLead permission } } } }`, { s: slug, p: projectId })).data
		?.workspace.project.members;
	assert.deepEqual(members, [{ isLead: true, permission: "full" }]);
});

test("sharing with a new email invites a guest who lands on the project", async () => {
	const { owner, slug, projectId } = await setup();
	const guest = await makeUser("guest");
	const res = await gql(owner, `mutation($s: String!, $p: ID!, $e: String!) { inviteToProject(slug: $s, projectId: $p, email: $e, permission: "edit") }`, {
		s: slug,
		p: projectId,
		e: guest.email,
	});
	assert.ok(res.data?.inviteToProject, JSON.stringify(res.errors));
	const { inviteCode } = (await gql(owner, `query($s: String!) { workspace(slug: $s) { inviteCode } }`, { s: slug })).data?.workspace;
	await join(guest, inviteCode);
	const ws = (await gql(guest, `query($s: String!) { workspace(slug: $s) { role projects { id myAccess } } }`, { s: slug })).data?.workspace;
	assert.equal(ws.role, "guest");
	assert.deepEqual(ws.projects, [{ id: projectId, myAccess: "edit" }]);
});
