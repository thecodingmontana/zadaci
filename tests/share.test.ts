import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const CREATE = `mutation($s: String!, $k: String!, $id: ID!) { createShareLink(slug: $s, kind: $k, id: $id) { token } }`;
const REVOKE = `mutation($s: String!, $k: String!, $id: ID!) { revokeShareLink(slug: $s, kind: $k, id: $id) }`;
const PUBLIC = `query($t: String!) { publicShare(token: $t) { kind title workspace doc tasks { key name status } } }`;
const allowPublic = (u: Parameters<typeof gql>[0], s: string, on: boolean) =>
	gql(u, `mutation($s: String!, $i: WorkspaceInput!) { updateWorkspace(slug: $s, input: $i) { id } }`, { s, i: { settings: { permPublic: on } } });

test("public links show a page or board to anyone, only while allowed and not revoked", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const note = (await gql(owner, `mutation($s: String!) { createNote(slug: $s, input: { title: "Launch plan" }) { id } }`, { s: slug })).data?.createNote;
	await gql(owner, `mutation($s: String!, $id: ID!, $p: NotePatch!) { updateNote(slug: $s, id: $id, patch: $p) { id } }`, {
		s: slug,
		id: note.id,
		p: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] } },
	});

	const off = await gql(owner, CREATE, { s: slug, k: "note", id: note.id });
	assert.match(off.errors?.[0]?.message ?? "", /Public links are off/);

	await allowPublic(owner, slug, true);
	assert.ok((await gql(member, CREATE, { s: slug, k: "note", id: note.id })).errors, "only full access makes links");
	const { token } = (await gql(owner, CREATE, { s: slug, k: "note", id: note.id })).data?.createShareLink;
	assert.equal((await gql(owner, CREATE, { s: slug, k: "note", id: note.id })).data?.createShareLink.token, token, "one live link per page");

	const seen = (await gql(null, PUBLIC, { t: token })).data?.publicShare;
	assert.equal(seen.title, "Launch plan");
	assert.equal(seen.kind, "note");
	assert.equal(seen.doc.content[0].content[0].text, "Hello world");

	await allowPublic(owner, slug, false);
	assert.equal((await gql(null, PUBLIC, { t: token })).data?.publicShare, null, "turning public links off stops them");
	await allowPublic(owner, slug, true);
	await gql(owner, REVOKE, { s: slug, k: "note", id: note.id });
	assert.equal((await gql(null, PUBLIC, { t: token })).data?.publicShare, null, "a revoked link shows nothing");

	await gql(owner, `mutation($s: String!, $id: ID!) { updateNote(slug: $s, id: $id, patch: { isPrivate: true }) { id } }`, { s: slug, id: note.id });
	assert.match((await gql(owner, CREATE, { s: slug, k: "note", id: note.id })).errors?.[0]?.message ?? "", /Private pages/);

	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id key } } }`, { s: slug })).data?.workspace.projects[0];
	const board = (await gql(owner, CREATE, { s: slug, k: "project", id: project.id })).data?.createShareLink;
	const shown = (await gql(null, PUBLIC, { t: board.token })).data?.publicShare;
	assert.equal(shown.kind, "project");
	assert.ok(shown.tasks.length > 0 && shown.tasks.every((t: { key: string }) => t.key.startsWith(`${project.key}-`)));
	assert.equal((await gql(null, PUBLIC, { t: "not-a-real-token-123" })).data?.publicShare, null);
});
