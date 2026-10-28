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

test("chat: everyone is in #general, and a channel's linked project or task only shows to those who can see it", async () => {
	const owner = await makeUser("owner");
	const guest = await makeUser("guest");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`, { s: slug, e: [guest.email] });
	await join(guest, inviteCode);
	const LIST = `query($s: String!) { workspace(slug: $s) { chatChannels { id name general people { name } link { kind id title } } } }`;
	const list = async (u: TestUser) => (await gql(u, LIST, { s: slug })).data?.workspace.chatChannels as { id: string; name: string; general: boolean; people: unknown[]; link: { kind: string; title: string } | null }[];

	// #general is made on first visit, once, with each visitor in it
	const [first] = (await list(owner)).filter((c) => c.general);
	assert.equal(first?.name, "general");
	const seen = (await list(guest)).filter((c) => c.general);
	assert.deepEqual(seen.map((c) => c.id), [first.id], "one #general per workspace");
	assert.equal(seen[0].people.length, 2, "both are in it");
	assert.match((await gql(owner, `mutation($s: String!) { createChatChannel(slug: $s, name: "General") { id } }`, { s: slug })).errors?.[0]?.message ?? "", /already exists/);

	// link a channel to a project the guest isn't on, and another to one of its tasks
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id title } } }`, { s: slug })).data?.workspace.projects[0];
	const CREATE = `mutation($s: String!, $n: String!, $p: ID, $t: ID) { createChatChannel(slug: $s, name: $n, projectId: $p, taskId: $t) { id link { kind title } } }`;
	const about = (await gql(owner, CREATE, { s: slug, n: "launch", p: project.id })).data?.createChatChannel;
	assert.deepEqual(about.link, { kind: "project", title: project.title });
	const task = (await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, { s: slug, i: { projectId: project.id, title: "Ship it" } })).data?.createTask;
	const onTask = (await gql(owner, CREATE, { s: slug, n: "ship-it", t: task.id })).data?.createChatChannel;
	assert.deepEqual(onTask.link, { kind: "task", title: "Ship it" });
	assert.match((await gql(owner, CREATE, { s: slug, n: "both", p: project.id, t: task.id })).errors?.[0]?.message ?? "", /not both/);

	// the guest sees the open channels, but not what they're about
	const guestView = await list(guest);
	assert.equal(guestView.find((c) => c.id === about.id)?.link, null, "a hidden project's title stays hidden");
	assert.equal(guestView.find((c) => c.id === onTask.id)?.link, null);
	// and can't link what they can't see
	assert.match((await gql(guest, CREATE, { s: slug, n: "peek", p: project.id })).errors?.[0]?.message ?? "", /not found/i);
});

test("chat: a team's channel follows the team; notes to yourself; threads, pins and favourites", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const sam = await makeUser("sam");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(pat, inviteCode);
	await join(sam, inviteCode);
	const LIST = `query($s: String!) { workspace(slug: $s) { members { id isMe } chatChannels { id name general teamId favorite private people { id } } } }`;
	const ws = async (u: TestUser) => (await gql(u, LIST, { s: slug })).data?.workspace as { members: { id: string; isMe: boolean }[]; chatChannels: { id: string; name: string; general: boolean; teamId: string | null; favorite: boolean; people: { id: string }[] }[] };
	const meOf = async (u: TestUser) => (await ws(u)).members.find((m) => m.isMe)?.id ?? "";
	const patId = await meOf(pat);

	// a team gets its channel, named after it, for its members only
	const TEAM = `mutation($s: String!, $i: TeamInput!) { createTeam(slug: $s, input: $i) { id } }`;
	const teamInput = (memberIds: string[]) => ({ name: "Design Crew", icon: "icon-[solar--code-linear]", color: "teal", memberIds });
	const teamId = (await gql(owner, TEAM, { s: slug, i: teamInput([patId]) })).data?.createTeam.id;
	const teamChannel = (await ws(pat)).chatChannels.find((c) => c.teamId === teamId);
	assert.equal(teamChannel?.name, "Design Crew");
	assert.deepEqual(teamChannel?.people.map((p) => p.id), [patId]);
	assert.ok(!(await ws(sam)).chatChannels.some((c) => c.teamId === teamId), "not on the team: not shown");
	assert.ok((await gql(pat, SEND, { s: slug, c: teamChannel?.id, b: "team only" })).data?.sendChatMessage);
	assert.match((await gql(sam, MESSAGES, { s: slug, c: teamChannel?.id })).errors?.[0]?.message ?? "", /not found/);
	// leaving the team ends access at once
	await gql(owner, `mutation($s: String!, $id: ID!, $i: TeamInput!) { updateTeam(slug: $s, id: $id, input: $i) { id } }`, { s: slug, id: teamId, i: teamInput([]) });
	assert.ok(!(await ws(pat)).chatChannels.some((c) => c.teamId === teamId));
	assert.match((await gql(pat, MESSAGES, { s: slug, c: teamChannel?.id })).errors?.[0]?.message ?? "", /not found/);

	// notes to yourself: a DM with just you, the same one every time
	const DM = `mutation($s: String!, $m: [ID!]!) { openChatDm(slug: $s, memberIds: $m) { id kind people { id } } }`;
	const self = (await gql(owner, DM, { s: slug, m: [] })).data?.openChatDm;
	assert.equal(self.kind, "dm");
	assert.equal(self.people.length, 1);
	assert.equal((await gql(owner, DM, { s: slug, m: [] })).data?.openChatDm.id, self.id);

	// threads: replies stay out of the channel, counted on the message they answer
	const general = (await ws(owner)).chatChannels.find((c) => c.general);
	const top = (await gql(owner, SEND, { s: slug, c: general?.id, b: "Plan for Friday?" })).data?.sendChatMessage;
	const REPLY = `mutation($s: String!, $c: ID!, $b: String!, $p: ID) { sendChatMessage(slug: $s, channelId: $c, body: $b, parentId: $p) { id parentId } }`;
	const reply = (await gql(pat, REPLY, { s: slug, c: general?.id, b: "Ship it", p: top.id })).data?.sendChatMessage;
	assert.equal(reply.parentId, top.id);
	const THREADS = `query($s: String!, $c: ID!, $p: ID) { chatMessages(slug: $s, channelId: $c, parentId: $p) { id replyCount pinned } }`;
	const main = (await gql(owner, THREADS, { s: slug, c: general?.id })).data?.chatMessages;
	assert.deepEqual(main.map((m: { id: string }) => m.id), [top.id], "the reply isn't in the channel");
	assert.equal(main[0].replyCount, 1);
	assert.deepEqual((await gql(owner, THREADS, { s: slug, c: general?.id, p: top.id })).data?.chatMessages.map((m: { id: string }) => m.id), [reply.id]);
	assert.match((await gql(pat, REPLY, { s: slug, c: general?.id, b: "deeper", p: reply.id })).errors?.[0]?.message ?? "", /isn't here/, "threads are one level deep");
	const notes = (await gql(owner, `query($s: String!) { workspace(slug: $s) { notifications { text } } }`, { s: slug })).data?.workspace.notifications;
	assert.ok(notes.some((n: { text: string }) => n.text === "replied to your message in #general"));

	// pins: anyone in the channel pins; Pins lists them
	const PIN = `mutation($s: String!, $id: ID!, $p: Boolean!) { pinChatMessage(slug: $s, id: $id, pinned: $p) { pinned } }`;
	assert.equal((await gql(pat, PIN, { s: slug, id: top.id, p: true })).data?.pinChatMessage.pinned, true);
	const PINS = `query($s: String!, $c: ID!) { chatPins(slug: $s, channelId: $c) { id } }`;
	assert.deepEqual((await gql(sam, PINS, { s: slug, c: general?.id })).data?.chatPins.map((m: { id: string }) => m.id), [top.id]);
	await gql(pat, PIN, { s: slug, id: top.id, p: false });
	assert.deepEqual((await gql(sam, PINS, { s: slug, c: general?.id })).data?.chatPins, []);
	assert.match((await gql(owner, PIN, { s: slug, id: (await gql(owner, `mutation($s: String!, $c: ID!) { sendChatMessage(slug: $s, channelId: $c, body: "private") { id } }`, { s: slug, c: teamChannel?.id })).data?.sendChatMessage?.id ?? "x", p: true })).errors?.[0]?.message ?? "", /not found/, "nothing in a channel you can't see");

	// favourites are yours alone
	await gql(pat, `mutation($s: String!, $c: ID!) { favoriteChatChannel(slug: $s, channelId: $c, favorite: true) }`, { s: slug, c: general?.id });
	assert.equal((await ws(pat)).chatChannels.find((c) => c.general)?.favorite, true);
	assert.equal((await ws(sam)).chatChannels.find((c) => c.general)?.favorite, false);
});

test("chat: files come only from the conversation's own upload folder, and a file alone is a message", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(pat, inviteCode);
	const cloud = process.env.CLOUDINARY_CLOUD_NAME;
	const LIST = `query($s: String!) { workspace(slug: $s) { members { id isMe } chatChannels { id general } } }`;
	const general = (await gql(owner, LIST, { s: slug })).data?.workspace.chatChannels.find((c: { general: boolean }) => c.general).id;
	const secret = (await gql(owner, `mutation($s: String!) { createChatChannel(slug: $s, name: "leads", private: true) { id } }`, { s: slug })).data?.createChatChannel.id;
	const SLOT = `mutation($s: String!, $c: ID!) { chatUpload(slug: $s, channelId: $c, file: true) { folder publicId } }`;
	const SEND = `mutation($s: String!, $c: ID!, $b: String!, $a: [ChatAttachmentInput!]) { sendChatMessage(slug: $s, channelId: $c, body: $b, attachments: $a) { body attachments { name size type seconds } } }`;

	// only people in the conversation get an upload slot, in its folder
	assert.match((await gql(pat, SLOT, { s: slug, c: secret })).errors?.[0]?.message ?? "", /not found/);
	const slot = (await gql(pat, SLOT, { s: slug, c: general })).data?.chatUpload;
	assert.equal(slot.folder, `zadaci/chat/${general}`);

	// stand in for Cloudinary: every uploaded file is 1 MB
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		init?.method === "HEAD"
			? new Response(null, { headers: { "content-length": String(1024 * 1024) } })
			: realFetch(input, init)) as typeof fetch;
	try {
		const voice = { url: `https://res.cloudinary.com/${cloud}/video/upload/v1/${slot.folder}/${slot.publicId}.webm`, name: "Voice note", size: 1048576, type: "audio/webm", seconds: 7 };
		const sent = (await gql(pat, SEND, { s: slug, c: general, b: "", a: [voice] })).data?.sendChatMessage;
		assert.deepEqual(sent, { body: "", attachments: [{ name: "Voice note", size: 1048576, type: "audio/webm", seconds: 7 }] }, "a file alone is a message");

		// a file from another conversation's folder, or anywhere else, is refused
		const elsewhere = { ...voice, url: `https://res.cloudinary.com/${cloud}/video/upload/v1/zadaci/chat/${secret}/${slot.publicId}.webm` };
		assert.match((await gql(pat, SEND, { s: slug, c: general, b: "look", a: [elsewhere] })).errors?.[0]?.message ?? "", /didn't come from this conversation/);
		assert.match((await gql(pat, SEND, { s: slug, c: general, b: "look", a: [{ ...voice, url: "https://evil.example/x.webm" }] })).errors?.[0]?.message ?? "", /didn't come from this conversation/);
		assert.match((await gql(pat, SEND, { s: slug, c: general, b: "", a: Array(11).fill(voice) })).errors?.[0]?.message ?? "", /up to 10 files/);
		assert.match((await gql(pat, SEND, { s: slug, c: general, b: "  " })).errors?.[0]?.message ?? "", /Write a message/, "no text and no file: nothing to send");
	} finally {
		globalThis.fetch = realFetch;
	}
});

test("chat: one pinned message per conversation, pinned conversations are yours, and only a channel's maker or an admin deletes it", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const sam = await makeUser("sam");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(pat, inviteCode);
	await join(sam, inviteCode);
	const LIST = `query($s: String!) { workspace(slug: $s) { members { id isMe } chatChannels { id name general teamId pinnedAt canDelete } } }`;
	const ws = async (u: TestUser) => (await gql(u, LIST, { s: slug })).data?.workspace as { members: { id: string; isMe: boolean }[]; chatChannels: { id: string; name: string; general: boolean; teamId: string | null; pinnedAt: string | null; canDelete: boolean }[] };
	const general = (await ws(owner)).chatChannels.find((c) => c.general);
	assert.equal(general?.canDelete, false, "#general stays");

	// pinning a second message replaces the first
	const first = (await gql(pat, SEND, { s: slug, c: general?.id, b: "first" })).data?.sendChatMessage.id;
	const second = (await gql(pat, SEND, { s: slug, c: general?.id, b: "second" })).data?.sendChatMessage.id;
	const PIN = `mutation($s: String!, $id: ID!) { pinChatMessage(slug: $s, id: $id, pinned: true) { id } }`;
	await gql(pat, PIN, { s: slug, id: first });
	await gql(sam, PIN, { s: slug, id: second });
	const pins = (await gql(owner, `query($s: String!, $c: ID!) { chatPins(slug: $s, channelId: $c) { id } }`, { s: slug, c: general?.id })).data?.chatPins;
	assert.deepEqual(pins.map((m: { id: string }) => m.id), [second]);

	// pinning a conversation to the top is yours alone
	await gql(pat, `mutation($s: String!, $c: ID!) { pinChatChannel(slug: $s, channelId: $c, pinned: true) }`, { s: slug, c: general?.id });
	assert.ok((await ws(pat)).chatChannels.find((c) => c.general)?.pinnedAt);
	assert.equal((await ws(sam)).chatChannels.find((c) => c.general)?.pinnedAt, null);

	// pat's channel: pat or the owner (an admin) may delete it, sam may not
	const make = async () => (await gql(pat, `mutation($s: String!) { createChatChannel(slug: $s, name: "standup") { id canDelete } }`, { s: slug })).data?.createChatChannel;
	const standup = await make();
	assert.equal(standup.canDelete, true);
	const DEL = `mutation($s: String!, $c: ID!) { deleteChatChannel(slug: $s, channelId: $c) }`;
	assert.match((await gql(sam, DEL, { s: slug, c: standup.id })).errors?.[0]?.message ?? "", /Only the person who made this channel/);
	assert.equal((await gql(owner, DEL, { s: slug, c: standup.id })).data?.deleteChatChannel, true);
	assert.ok(!(await ws(pat)).chatChannels.some((c) => c.id === standup.id), "gone from the list");
	assert.match((await gql(pat, `query($s: String!, $c: ID!) { chatMessages(slug: $s, channelId: $c) { id } }`, { s: slug, c: standup.id })).errors?.[0]?.message ?? "", /not found/);
	assert.match((await gql(owner, DEL, { s: slug, c: general?.id })).errors?.[0]?.message ?? "", /can't be deleted/);

	// a team called General gets its own channel, and #general is still the only #general
	const patId = (await ws(pat)).members.find((m) => m.isMe)?.id;
	await gql(owner, `mutation($s: String!, $i: TeamInput!) { createTeam(slug: $s, input: $i) { id } }`, { s: slug, i: { name: "General", icon: "icon-[solar--code-linear]", color: "teal", memberIds: [patId] } });
	const patView = (await ws(pat)).chatChannels;
	assert.equal(patView.filter((c) => c.general).length, 1);
	assert.equal(patView.find((c) => c.teamId)?.name, "General", "shown with the team's name");
	assert.equal(patView.find((c) => c.teamId)?.general, false);
});
