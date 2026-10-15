import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const NOTIFS = `query($s: String!) { workspace(slug: $s) { unreadNotifications notifications { id text read } } }`;

test("joins and role changes land in the feed and notify the right people", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);

	// The owner hears that someone joined; the member who joined doesn't.
	const ownerView = await gql(owner, NOTIFS, { s: slug });
	assert.equal(ownerView.data?.workspace.unreadNotifications, 1);
	assert.match(ownerView.data?.workspace.notifications[0].text, /^joined /);
	assert.equal((await gql(member, NOTIFS, { s: slug })).data?.workspace.unreadNotifications, 0);

	const ws = await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug });
	const memberId = ws.data?.workspace.members.find((m: { isMe: boolean }) => !m.isMe).id;
	await gql(owner, `mutation($s: String!, $m: ID!) { updateMemberRole(slug: $s, memberId: $m, role: "moderator") { id } }`, {
		s: slug,
		m: memberId,
	});
	const memberView = await gql(member, NOTIFS, { s: slug });
	assert.match(memberView.data?.workspace.notifications[0].text, /changed your role .* to admin/);

	const feed = await gql(member, `query($s: String!) { workspace(slug: $s) { activity { verb } } }`, { s: slug });
	assert.deepEqual(
		feed.data?.workspace.activity.map((a: { verb: string }) => a.verb),
		["changed the role of", "joined the workspace", "created project"],
	);
	const projects = await gql(member, `query($s: String!) { workspace(slug: $s) { activity(filter: "projects") { verb } } }`, { s: slug });
	assert.deepEqual(projects.data?.workspace.activity.map((a: { verb: string }) => a.verb), ["created project"]);
});

test("people can only read and mark their own notifications", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const id = (await gql(owner, NOTIFS, { s: slug })).data?.workspace.notifications[0].id;

	const MARK = `mutation($s: String!, $id: ID!) { setNotificationRead(slug: $s, id: $id, read: true) { read } }`;
	assert.ok((await gql(member, MARK, { s: slug, id })).errors?.length, "someone else's notification");
	assert.equal((await gql(owner, NOTIFS, { s: slug })).data?.workspace.unreadNotifications, 1);

	assert.equal((await gql(owner, MARK, { s: slug, id })).data?.setNotificationRead.read, true);
	assert.equal((await gql(owner, NOTIFS, { s: slug })).data?.workspace.unreadNotifications, 0);
});
