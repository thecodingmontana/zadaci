import assert from "node:assert/strict";
import { after, test } from "node:test";
import { snippet } from "#/lib/search";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const SEARCH = `query($s: String!, $q: String!) { search(slug: $s, q: $q) {
	tasks { name } notes { title snippet } bookmarks { title } comments { snippet taskName }
} }`;

test("search finds tasks, notes, bookmarks and comments, but never someone else's private items", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];

	const task = (await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, {
		s: slug,
		i: { projectId: project.id, title: "Zebra launch", description: "" },
	})).data?.createTask;
	await gql(owner, `mutation($s: String!, $t: ID!) { addComment(slug: $s, taskId: $t, text: "the zebra copy needs work") { id } }`, { s: slug, t: task.id });

	const note = (await gql(owner, `mutation($s: String!) { createNote(slug: $s, input: { title: "Plans" }) { id } }`, { s: slug })).data?.createNote;
	await gql(owner, `mutation($s: String!, $id: ID!, $p: NotePatch!) { updateNote(slug: $s, id: $id, patch: $p) { id } }`, {
		s: slug,
		id: note.id,
		p: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "We ship the zebra feature in May." }] }] } },
	});
	const secret = (await gql(owner, `mutation($s: String!) { createNote(slug: $s, input: { title: "Zebra diary" }) { id } }`, { s: slug })).data?.createNote;
	await gql(owner, `mutation($s: String!, $id: ID!) { updateNote(slug: $s, id: $id, patch: { isPrivate: true }) { id } }`, { s: slug, id: secret.id });

	const BM = `mutation($s: String!, $i: NewBookmark!) { createBookmark(slug: $s, input: $i) { id } }`;
	await gql(owner, BM, { s: slug, i: { url: "https://example.com/z", title: "Zebra research" } });
	await gql(owner, BM, { s: slug, i: { url: "https://example.com/p", title: "Zebra salaries", isPrivate: true } });

	const mine = (await gql(owner, SEARCH, { s: slug, q: "zebra" })).data?.search;
	assert.deepEqual(mine.tasks, [{ name: "Zebra launch" }]);
	assert.deepEqual(mine.notes.map((n: { title: string }) => n.title).sort(), ["Plans", "Zebra diary"]);
	assert.match(mine.notes.find((n: { title: string }) => n.title === "Plans").snippet, /zebra feature/, "body matches show where");
	assert.deepEqual(mine.bookmarks.map((b: { title: string }) => b.title).sort(), ["Zebra research", "Zebra salaries"]);
	assert.deepEqual(mine.comments, [{ snippet: "the zebra copy needs work", taskName: "Zebra launch" }]);

	const theirs = (await gql(member, SEARCH, { s: slug, q: "zebra" })).data?.search;
	assert.deepEqual(theirs.notes.map((n: { title: string }) => n.title), ["Plans"], "private pages stay private");
	assert.deepEqual(theirs.bookmarks.map((b: { title: string }) => b.title), ["Zebra research"], "private bookmarks stay private");

	const outsider = await makeUser("outsider");
	assert.ok((await gql(outsider, SEARCH, { s: slug, q: "zebra" })).errors, "outsiders can't search the workspace");
});

test("snippets show the words around the match", () => {
	assert.equal(snippet("short text here", "text"), "short text here");
	assert.equal(snippet("nothing", "zebra"), null);
	const long = `${"a ".repeat(50)}zebra${" b".repeat(50)}`;
	const s = snippet(long, "ZEBRA", 10) ?? "";
	assert.ok(s.startsWith("…") && s.endsWith("…") && s.includes("zebra"));
});
