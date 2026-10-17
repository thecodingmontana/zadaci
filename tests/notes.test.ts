import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const FIELDS = "id parentId title sortOrder canEdit";
const create = (u: TestUser, s: string, input: Record<string, unknown>) =>
	gql(u, `mutation($s: String!, $i: NewNote!) { createNote(slug: $s, input: $i) { ${FIELDS} } }`, { s, i: input });
const list = async (u: TestUser, s: string) =>
	(await gql(u, `query($s: String!) { notes(slug: $s) { ${FIELDS} } }`, { s })).data?.notes as { id: string; parentId: string | null; title: string }[];
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function setup() {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	return { owner, member, slug, inviteCode };
}

test("pages nest, move and can't go inside themselves", async () => {
	const { owner, member, slug } = await setup();
	const parent = (await create(owner, slug, { title: "Guides", icon: "📘" })).data?.createNote;
	const child = (await create(member, slug, { title: "Onboarding", parentId: parent.id })).data?.createNote;
	assert.equal(child.parentId, parent.id);
	assert.equal(child.canEdit, true, "members edit pages in the workspace");

	const MOVE = `mutation($s: String!, $id: ID!, $p: ID, $o: Float!) { moveNote(slug: $s, id: $id, parentId: $p, sortOrder: $o) { id parentId } }`;
	assert.equal(code(await gql(owner, MOVE, { s: slug, id: parent.id, p: child.id, o: 1 })), "BAD_USER_INPUT");
	const moved = await gql(owner, MOVE, { s: slug, id: child.id, p: null, o: 0.5 });
	assert.equal(moved.data?.moveNote.parentId, null);
	assert.deepEqual((await list(member, slug)).map((n) => n.title), ["Onboarding", "Guides"], "ordered by sortOrder");
});

test("outsiders and guests don't see workspace pages; deleting a page takes its sub-pages", async () => {
	const { owner, member, slug } = await setup();
	const page = (await create(owner, slug, { title: "Roadmap" })).data?.createNote;
	await create(owner, slug, { title: "Q3", parentId: page.id });

	const outsider = await makeUser("outsider");
	assert.equal(code(await gql(outsider, `query($s: String!) { notes(slug: $s) { id } }`, { s: slug })), "NOT_FOUND");

	const guest = await makeUser("guest");
	await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`, { s: slug, e: [guest.email] });
	const { inviteCode } = (await gql(owner, `query($s: String!) { workspace(slug: $s) { inviteCode } }`, { s: slug })).data?.workspace;
	await join(guest, inviteCode);
	assert.deepEqual(await list(guest, slug), []);
	assert.equal(code(await create(guest, slug, { title: "Mine" })), "FORBIDDEN");

	const DELETE = `mutation($s: String!, $id: ID!) { deleteNote(slug: $s, id: $id) }`;
	assert.equal(code(await gql(member, DELETE, { s: slug, id: page.id })), "FORBIDDEN", "only the author or an admin deletes");
	await gql(owner, DELETE, { s: slug, id: page.id });
	assert.deepEqual(await list(owner, slug), []);
});

test("bodies are checked, and an older editor can't overwrite a newer save", async () => {
	const { owner, member, slug } = await setup();
	const page = (await create(owner, slug, { title: "Spec" })).data?.createNote;
	const UPDATE = `mutation($s: String!, $id: ID!, $p: NotePatch!, $b: String) { updateNote(slug: $s, id: $id, patch: $p, baseUpdatedAt: $b) { excerpt updatedAt } }`;
	const bad = await gql(owner, UPDATE, { s: slug, id: page.id, p: { doc: { type: "doc", content: [{ type: "iframe" }] } } });
	assert.equal(code(bad), "BAD_USER_INPUT");

	const loaded = new Date(Date.now() - 60_000).toISOString();
	const saved = await gql(owner, UPDATE, { s: slug, id: page.id, p: { doc: doc("First draft") } });
	assert.equal(saved.data?.updateNote.excerpt, "First draft");
	assert.equal(code(await gql(member, UPDATE, { s: slug, id: page.id, p: { title: "x" }, b: loaded })), "CONFLICT");
	const body = await gql(member, `query($s: String!, $id: ID!) { note(slug: $s, id: $id) { doc } }`, { s: slug, id: page.id });
	assert.deepEqual(body.data?.note.doc, doc("First draft"));
});

test("comments quote a passage, take replies and can be resolved", async () => {
	const { owner, member, slug } = await setup();
	const page = (await create(owner, slug, { title: "Review" })).data?.createNote;
	const ADD = `mutation($s: String!, $n: ID!, $t: String!, $q: String, $p: ID) { addNoteComment(slug: $s, noteId: $n, text: $t, quote: $q, parentId: $p) { id quote parentId resolved } }`;
	const first = (await gql(member, ADD, { s: slug, n: page.id, t: "Tighten this", q: "client expectations" })).data?.addNoteComment;
	assert.equal(first.quote, "client expectations");
	const reply = (await gql(owner, ADD, { s: slug, n: page.id, t: "Done", p: first.id })).data?.addNoteComment;
	assert.equal(reply.parentId, first.id);

	const resolved = await gql(owner, `mutation($s: String!, $id: ID!) { resolveNoteComment(slug: $s, id: $id, resolved: true) { resolved } }`, { s: slug, id: first.id });
	assert.equal(resolved.data?.resolveNoteComment.resolved, true);
	const react = await gql(owner, `mutation($s: String!, $id: ID!) { reactToComment(slug: $s, id: $id, emoji: "👍") { reactions { emoji count } } }`, { s: slug, id: first.id });
	assert.deepEqual(react.data?.reactToComment.reactions, [{ emoji: "👍", count: 1 }], "task comment actions work on note comments");
	const all = await gql(member, `query($s: String!, $id: ID!) { note(slug: $s, id: $id) { comments { id } } }`, { s: slug, id: page.id });
	assert.equal(all.data?.note.comments.length, 2);
});

test("private pages and the pages inside them are only the author's; stars are per person", async () => {
	const { owner, member, slug } = await setup();
	const page = (await create(owner, slug, { title: "Diary" })).data?.createNote;
	const inside = (await create(owner, slug, { title: "Monday", parentId: page.id })).data?.createNote;
	const UPDATE = `mutation($s: String!, $id: ID!, $p: NotePatch!) { updateNote(slug: $s, id: $id, patch: $p) { isPrivate } }`;
	assert.equal(code(await gql(member, UPDATE, { s: slug, id: page.id, p: { isPrivate: true } })), "FORBIDDEN", "only the author");
	await gql(owner, UPDATE, { s: slug, id: page.id, p: { isPrivate: true } });
	assert.deepEqual(await list(member, slug), []);
	assert.equal(code(await gql(member, `query($s: String!, $id: ID!) { note(slug: $s, id: $id) { id } }`, { s: slug, id: inside.id })), "BAD_USER_INPUT");
	const later = (await create(owner, slug, { title: "Tuesday", parentId: page.id })).data?.createNote;
	assert.equal((await list(owner, slug)).length, 3);
	assert.equal(later.id && (await list(member, slug)).length, 0, "new sub-pages stay private too");

	const STAR = `mutation($s: String!, $id: ID!) { toggleNoteFavorite(slug: $s, id: $id) }`;
	assert.equal((await gql(owner, STAR, { s: slug, id: page.id })).data?.toggleNoteFavorite, true);
	const mine = (await gql(owner, `query($s: String!) { notes(slug: $s) { id isFavorite } }`, { s: slug })).data?.notes;
	assert.equal(mine.find((n: { id: string }) => n.id === page.id).isFavorite, true);
});

test("covers take gallery colours and https images, and keep their position", async () => {
	const { owner, slug } = await setup();
	const page = (await create(owner, slug, { title: "Cover" })).data?.createNote;
	const UPDATE = `mutation($s: String!, $id: ID!, $p: NotePatch!) { updateNote(slug: $s, id: $id, patch: $p) { cover coverY } }`;
	const set = (p: Record<string, unknown>) => gql(owner, UPDATE, { s: slug, id: page.id, p });
	assert.deepEqual((await set({ cover: "gallery:dusk" })).data?.updateNote, { cover: "gallery:dusk", coverY: 50 });
	assert.equal(code(await set({ cover: "javascript:alert(1)" })), "BAD_USER_INPUT");
	assert.deepEqual((await set({ cover: "https://images.example.com/a.jpg", coverY: 130 })).data?.updateNote, { cover: "https://images.example.com/a.jpg", coverY: 100 });
	assert.equal((await set({ cover: null })).data?.updateNote.cover, null);
});
