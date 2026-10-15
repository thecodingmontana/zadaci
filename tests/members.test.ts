import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("member stats count each person's active projects", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const res = await gql(
		owner,
		`query($s: String!) { workspace(slug: $s) { members { id isMe } memberStats { memberId activeProjects openTasks lastActiveAt } } }`,
		{ s: slug },
	);
	const ws = res.data?.workspace;
	const stat = (isMe: boolean) =>
		ws.memberStats.find((s: { memberId: string }) => s.memberId === ws.members.find((m: { isMe: boolean }) => m.isMe === isMe).id);
	// The owner is on the starter project; the new member isn't on any yet.
	assert.equal(stat(true).activeProjects, 1);
	assert.equal(stat(false).activeProjects, 0);
	assert.equal(stat(true).openTasks, 0);
	assert.ok(stat(true).lastActiveAt, "owner has a session");
});

test("only owners and admins can resend invites", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const invited = await gql(owner, `mutation($s: String!) { inviteMembers(slug: $s, emails: ["pat@example.com"], role: "member") { id } }`, { s: slug });
	const id = invited.data?.inviteMembers[0].id;
	const res = await gql(member, `mutation($s: String!, $id: ID!) { resendInvite(slug: $s, id: $id) }`, { s: slug, id });
	assert.equal(res.errors?.[0]?.extensions?.code, "FORBIDDEN");
});
