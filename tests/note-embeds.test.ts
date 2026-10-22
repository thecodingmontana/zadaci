import assert from "node:assert/strict";
import { after, test } from "node:test";
import { checkDoc } from "#/lib/note-doc";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const EMBED = `query($s: String!, $k: String!, $id: ID!) { noteEmbed(slug: $s, kind: $k, id: $id) { title sub href } }`;
const page = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "itemEmbed", attrs }] });

test("pages store task and bookmark cards, and each reader sees only what they may", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id title } } }`, { s: slug })).data?.workspace.projects[0];
	const task = (await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, { s: slug, i: { projectId: project.id, title: "Ship it" } })).data?.createTask;
	const BM = `mutation($s: String!, $i: NewBookmark!) { createBookmark(slug: $s, input: $i) { id } }`;
	const open = (await gql(owner, BM, { s: slug, i: { url: "https://example.com/a", title: "Guide" } })).data?.createBookmark;
	const secret = (await gql(owner, BM, { s: slug, i: { url: "https://example.com/b", title: "Secret", isPrivate: true } })).data?.createBookmark;

	const note = (await gql(owner, `mutation($s: String!) { createNote(slug: $s, input: { title: "Plan" }) { id } }`, { s: slug })).data?.createNote;
	const saved = await gql(owner, `mutation($s: String!, $id: ID!, $p: NotePatch!) { updateNote(slug: $s, id: $id, patch: $p) { id } }`, {
		s: slug,
		id: note.id,
		p: { doc: page({ kind: "task", id: task.id }) },
	});
	assert.ok(!saved.errors, JSON.stringify(saved.errors));

	const t = (await gql(member, EMBED, { s: slug, k: "task", id: task.id })).data?.noteEmbed;
	assert.deepEqual(t, { title: "Ship it", sub: project.title, href: `/w/${slug}/p/${project.id}?task=${task.id}` });
	assert.equal((await gql(member, EMBED, { s: slug, k: "bookmark", id: open.id })).data?.noteEmbed.title, "Guide");
	assert.equal((await gql(member, EMBED, { s: slug, k: "bookmark", id: secret.id })).data?.noteEmbed, null, "private bookmarks show as no access");
	assert.equal((await gql(owner, EMBED, { s: slug, k: "bookmark", id: secret.id })).data?.noteEmbed.title, "Secret");

	const outsider = await makeUser("outsider");
	assert.ok((await gql(outsider, EMBED, { s: slug, k: "task", id: task.id })).errors, "outsiders get nothing");
});

test("only well-formed task and bookmark cards are saved", () => {
	assert.doesNotThrow(() => checkDoc(page({ kind: "bookmark", id: "abc123" })));
	assert.throws(() => checkDoc(page({ kind: "project", id: "abc123" })), /can't be shown/);
	assert.throws(() => checkDoc(page({ kind: "task", id: "<script>" })), /can't be shown/);
});
