import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

const CHANNELS = `query($s: String!) { workspace(slug: $s) { chatChannels { id kind name private unread people { name } } } }`;
const MESSAGES = `query($s: String!, $c: ID!) { chatMessages(slug: $s, channelId: $c) { id body mine author { name } reactions { emoji count mine } } }`;
const SEND = `mutation($s: String!, $c: ID!, $b: String!) { sendChatMessage(slug: $s, channelId: $c, body: $b) { id body mine } }`;

test("chat: open channels for the workspace, private ones and DMs only for their members", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const sam = await makeUser("sam");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(pat, inviteCode);
	await join(sam, inviteCode);
	const memberId = async (u: TestUser) =>
		(await gql(u, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug })).data?.workspace.members.find((m: { isMe: boolean }) => m.isMe).id;
	const channels = async (u: TestUser) => (await gql(u, CHANNELS, { s: slug })).data?.workspace.chatChannels as { id: string; name: string; unread: number; kind: string }[];

	// an open channel: everyone sees it and can talk
	const general = (await gql(owner, `mutation($s: String!) { createChatChannel(slug: $s, name: "General Talk") { id name private } }`, { s: slug })).data?.createChatChannel;
	assert.equal(general.name, "general-talk");
	assert.ok((await channels(sam)).some((c) => c.id === general.id), "open channel is visible to the workspace");
	const sent = (await gql(pat, SEND, { s: slug, c: general.id, b: "  Hi @owner  " })).data?.sendChatMessage;
	assert.deepEqual({ body: sent.body, mine: sent.mine }, { body: "Hi @owner", mine: true });

	// unread: the owner joined when creating it, so pat's message counts; reading clears it
	assert.equal((await channels(owner)).find((c) => c.id === general.id)?.unread, 1);
	await gql(owner, `mutation($s: String!, $c: ID!) { markChatRead(slug: $s, channelId: $c) }`, { s: slug, c: general.id });
	assert.equal((await channels(owner)).find((c) => c.id === general.id)?.unread, 0);

	// the mention reached the owner
	const notes = (await gql(owner, `query($s: String!) { workspace(slug: $s) { notifications { type text } } }`, { s: slug })).data?.workspace.notifications;
	assert.ok(notes.some((n: { text: string }) => n.text === "mentioned you in #general-talk"));

	// a private channel: invisible to sam for listing, reading and sending
	const secret = (await gql(owner, `mutation($s: String!, $m: [ID!]) { createChatChannel(slug: $s, name: "leads", private: true, memberIds: $m) { id } }`, { s: slug, m: [await memberId(pat)] })).data?.createChatChannel;
	assert.ok((await channels(pat)).some((c) => c.id === secret.id));
	assert.ok(!(await channels(sam)).some((c) => c.id === secret.id), "hidden from non-members");
	assert.match((await gql(sam, MESSAGES, { s: slug, c: secret.id })).errors?.[0]?.message ?? "", /not found/);
	assert.match((await gql(sam, SEND, { s: slug, c: secret.id, b: "let me in" })).errors?.[0]?.message ?? "", /not found/);

	// a DM: the same people always get the same conversation, and only they see it
	const DM = `mutation($s: String!, $m: [ID!]!) { openChatDm(slug: $s, memberIds: $m) { id kind } }`;
	const dm = (await gql(owner, DM, { s: slug, m: [await memberId(pat)] })).data?.openChatDm;
	assert.equal(dm.kind, "dm");
	assert.equal((await gql(pat, DM, { s: slug, m: [await memberId(owner)] })).data?.openChatDm.id, dm.id);
	assert.ok(!(await channels(sam)).some((c) => c.id === dm.id));

	// only your own messages can be edited or deleted; anyone in the channel can react
	assert.match((await gql(sam, `mutation($s: String!, $id: ID!) { editChatMessage(slug: $s, id: $id, body: "x") { id } }`, { s: slug, id: sent.id })).errors?.[0]?.message ?? "", /your own/);
	const reacted = (await gql(sam, `mutation($s: String!, $id: ID!) { reactToChatMessage(slug: $s, id: $id, emoji: "🎉") { reactions { emoji count mine } } }`, { s: slug, id: sent.id })).data?.reactToChatMessage;
	assert.deepEqual(reacted.reactions, [{ emoji: "🎉", count: 1, mine: true }]);
	assert.ok((await gql(pat, `mutation($s: String!, $id: ID!) { deleteChatMessage(slug: $s, id: $id) }`, { s: slug, id: sent.id })).data?.deleteChatMessage);
	assert.deepEqual((await gql(owner, MESSAGES, { s: slug, c: general.id })).data?.chatMessages, [], "deleted messages are gone");

	// an empty message is refused, and someone outside the workspace sees nothing
	assert.match((await gql(pat, SEND, { s: slug, c: general.id, b: "   " })).errors?.[0]?.message ?? "", /Write a message/);
	const stranger = await makeUser("stranger");
	assert.ok((await gql(stranger, MESSAGES, { s: slug, c: general.id })).errors?.length);
});
