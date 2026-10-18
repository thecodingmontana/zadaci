import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const FIELDS = "id url title tags kind collectionIds archivedAt canEdit canDelete isFavorite";
type Row = { id: string; title: string; tags: string[]; collectionIds: string[]; archivedAt: string | null; canEdit: boolean; canDelete: boolean; isFavorite: boolean };
const add = (u: TestUser, s: string, input: Record<string, unknown>) =>
	gql(u, `mutation($s: String!, $i: NewBookmark!) { createBookmark(slug: $s, input: $i) { ${FIELDS} } }`, { s, i: input });
const list = async (u: TestUser, s: string) =>
	(await gql(u, `query($s: String!) { bookmarks(slug: $s) { ${FIELDS} } }`, { s })).data?.bookmarks as Row[];
const collection = async (u: TestUser, s: string, input: Record<string, unknown>) =>
	(await gql(u, `mutation($s: String!, $i: NewBookmarkCollection!) { createBookmarkCollection(slug: $s, input: $i) { id canDelete } }`, { s, i: input })).data
		?.createBookmarkCollection as { id: string; canDelete: boolean };
const collections = async (u: TestUser, s: string) =>
	(await gql(u, `query($s: String!) { bookmarkCollections(slug: $s) { id name count } }`, { s })).data?.bookmarkCollections as { id: string; name: string; count: number }[];
const MOVE = `mutation($s: String!, $id: ID!, $c: [ID!]!) { moveBookmark(slug: $s, id: $id, collectionIds: $c) { collectionIds } }`;

async function setup() {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	return { owner, member, slug };
}

test("links are checked and tags tidied; unsorted bookmarks are open to members, not outsiders", async () => {
	const { owner, member, slug } = await setup();
	const saved = (await add(owner, slug, { url: "example.com/post", title: "Post", tags: ["#Design", "design", " UI "] })).data?.createBookmark;
	assert.equal(saved.url, "https://example.com/post");
	assert.deepEqual(saved.tags, ["design", "UI"], "one spelling per tag, # dropped");
	assert.equal(saved.kind, "article");

	assert.equal(code(await add(owner, slug, { url: "javascript:alert(1)", title: "x" })), "BAD_USER_INPUT");
	assert.equal(code(await add(owner, slug, { url: "https://example.com", title: "x", image: "http://169.254.169.254/x.png" })), "BAD_USER_INPUT");
	assert.equal(code(await add(owner, slug, { url: "http://127.0.0.1/admin" })), "BAD_USER_INPUT", "a quick add can't read internal pages");
	assert.equal(code(await gql(owner, `query($s: String!) { linkPreview(slug: $s, url: "http://localhost.localdomain./") { title } }`, { s: slug })), "BAD_USER_INPUT");

	const seen = await list(member, slug);
	assert.deepEqual(seen.map((b) => [b.title, b.canEdit, b.canDelete]), [["Post", true, false]], "members edit, only the author deletes");
	assert.equal(code(await gql(member, `mutation($s: String!, $id: ID!) { deleteBookmark(slug: $s, id: $id) }`, { s: slug, id: saved.id })), "FORBIDDEN");

	const outsider = await makeUser("outsider");
	assert.equal(code(await gql(outsider, `query($s: String!) { bookmarks(slug: $s) { id } }`, { s: slug })), "NOT_FOUND");
});

test("a private collection hides its links; deleting it keeps the ones filed elsewhere", async () => {
	const { owner, member, slug } = await setup();
	const secret = await collection(owner, slug, { name: "Reading", icon: "📚", isPrivate: true });
	const shared = await collection(owner, slug, { name: "Design" });
	const onlySecret = (await add(owner, slug, { url: "https://a.example.com", title: "Secret", collectionIds: [secret.id] })).data?.createBookmark;
	const both = (await add(owner, slug, { url: "https://b.example.com", title: "Both", collectionIds: [secret.id, shared.id] })).data?.createBookmark;
	assert.deepEqual(both.collectionIds.sort(), [secret.id, shared.id].sort());

	const seen = await list(member, slug);
	assert.deepEqual(seen.map((b) => [b.title, b.collectionIds]), [["Both", [shared.id]]], "the private collection never shows");
	assert.deepEqual((await collections(member, slug)).map((c) => c.name), ["Design"]);
	assert.equal(code(await add(member, slug, { url: "https://c.example.com", title: "x", collectionIds: [secret.id] })), "BAD_USER_INPUT");

	// the member files "Both" nowhere: the owner's private filing stays
	await gql(member, MOVE, { s: slug, id: both.id, c: [] });
	const mine = (await list(owner, slug)).find((b) => b.id === both.id);
	assert.deepEqual(mine?.collectionIds, [secret.id]);
	await gql(owner, MOVE, { s: slug, id: both.id, c: [secret.id, shared.id] });

	await gql(owner, `mutation($s: String!, $id: ID!) { deleteBookmarkCollection(slug: $s, id: $id) }`, { s: slug, id: secret.id });
	const left = await list(owner, slug);
	assert.equal(left.some((b) => b.id === onlySecret.id), false, "its own links go with it, instead of opening to everyone");
	assert.deepEqual(left.find((b) => b.id === both.id)?.collectionIds, [shared.id]);
});

test("guests can't see or add unsorted links or open collections", async () => {
	const { owner, slug } = await setup();
	await add(owner, slug, { url: "https://example.com", title: "Open" });
	const guest = await makeUser("guest");
	await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`, { s: slug, e: [guest.email] });
	const { inviteCode } = (await gql(owner, `query($s: String!) { workspace(slug: $s) { inviteCode } }`, { s: slug })).data?.workspace;
	await join(guest, inviteCode);
	assert.deepEqual(await list(guest, slug), []);
	assert.equal(code(await add(guest, slug, { url: "https://example.com/g", title: "Mine" })), "FORBIDDEN");
	assert.equal(code(await gql(guest, `mutation($s: String!) { createBookmarkCollection(slug: $s, input: { name: "G" }) { id } }`, { s: slug })), "FORBIDDEN");
});

test("collections linked to a project follow its sharing", async () => {
	const { owner, member, slug } = await setup();
	const alpha = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0].id;
	const linked = await collection(owner, slug, { name: "Alpha refs", projectId: alpha });
	const saved = (await add(owner, slug, { url: "https://example.com/spec", title: "Spec", collectionIds: [linked.id] })).data?.createBookmark;
	const seen = (await list(member, slug)).find((b) => b.id === saved.id);
	assert.equal(seen?.canEdit, false, "members only comment on workspace projects, so they can't edit");
	assert.equal(code(await gql(member, `mutation($s: String!, $id: ID!) { archiveBookmark(slug: $s, id: $id, archived: true) { id } }`, { s: slug, id: saved.id })), "FORBIDDEN");
	assert.equal(code(await gql(member, `mutation($s: String!, $id: ID!, $p: BookmarkCollectionPatch!) { updateBookmarkCollection(slug: $s, id: $id, patch: $p) { id } }`, { s: slug, id: linked.id, p: { projectId: null } })), "FORBIDDEN");

	await gql(owner, `mutation($s: String!, $p: ID!) { deleteProject(slug: $s, projectId: $p) }`, { s: slug, p: alpha });
	assert.equal((await list(member, slug)).some((b) => b.id === saved.id), false, "a deleted project's links are hidden");
});

test("archiving drops a link from the counts; stars are per person; edits are checked", async () => {
	const { owner, member, slug } = await setup();
	const design = await collection(owner, slug, { name: "Design" });
	const saved = (await add(member, slug, { url: "https://example.com/v", title: "Talk", kind: "video", collectionIds: [design.id] })).data?.createBookmark;
	assert.equal((await collections(owner, slug))[0]?.count, 1);

	const ARCHIVE = `mutation($s: String!, $id: ID!, $a: Boolean!) { archiveBookmark(slug: $s, id: $id, archived: $a) { archivedAt } }`;
	assert.ok((await gql(member, ARCHIVE, { s: slug, id: saved.id, a: true })).data?.archiveBookmark.archivedAt);
	assert.equal((await collections(owner, slug))[0]?.count, 0);

	const STAR = `mutation($s: String!, $id: ID!) { toggleBookmarkFavorite(slug: $s, id: $id) }`;
	assert.equal((await gql(owner, STAR, { s: slug, id: saved.id })).data?.toggleBookmarkFavorite, true);
	assert.equal((await list(owner, slug))[0]?.isFavorite, true);
	assert.equal((await list(member, slug))[0]?.isFavorite, false);
	assert.equal((await gql(owner, STAR, { s: slug, id: saved.id })).data?.toggleBookmarkFavorite, false);

	const UPDATE = `mutation($s: String!, $id: ID!, $p: BookmarkPatch!) { updateBookmark(slug: $s, id: $id, patch: $p) { title tags kind } }`;
	assert.deepEqual((await gql(owner, UPDATE, { s: slug, id: saved.id, p: { title: "Keynote", tags: ["Talks"], kind: "article" } })).data?.updateBookmark, {
		title: "Keynote",
		tags: ["Talks"],
		kind: "article",
	});
	assert.equal(code(await gql(owner, UPDATE, { s: slug, id: saved.id, p: { title: "  " } })), "BAD_USER_INPUT");
	assert.equal(code(await gql(owner, UPDATE, { s: slug, id: saved.id, p: { kind: "podcast" } })), "BAD_USER_INPUT");
	assert.equal((await gql(member, `mutation($s: String!, $id: ID!) { deleteBookmark(slug: $s, id: $id) }`, { s: slug, id: saved.id })).data?.deleteBookmark, true, "authors delete their own");
});
