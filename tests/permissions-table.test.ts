import assert from "node:assert/strict";
import { after, test } from "node:test";
import { can, hasRight, PROJECT_ABILITIES, PROJECT_RIGHTS } from "#/lib/permissions";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

// The "Roles & permissions" and "Project access" tables in Settings are generated from
// lib/permissions. These tests try a real action for each row, per role and per project
// right, so a tick in a table means the server allows it and a dash means it refuses.

after(cleanup);

type Res = Awaited<ReturnType<typeof gql>>;
const allowed = (res: Res) => !res.errors?.length;
const WS = `query($s: String!) { workspace(slug: $s) { inviteCode members { id isMe } projects { id } } }`;

async function joinAs(owner: TestUser, slug: string, role: "moderator" | "member" | "guest") {
	const user = await makeUser(role);
	if (role !== "member")
		await gql(owner, `mutation($s: String!, $e: [String!]!, $r: String!) { inviteMembers(slug: $s, emails: $e, role: $r) { id } }`, {
			s: slug,
			e: [user.email],
			r: role,
		});
	const { inviteCode } = (await gql(owner, WS, { s: slug })).data?.workspace;
	await join(user, inviteCode);
	return user;
}

const addBookmark = (u: TestUser, s: string, title: string) =>
	gql(u, `mutation($s: String!, $t: String!) { createBookmark(slug: $s, input: { url: "https://example.com", title: $t }) { id } }`, { s, t: title });
const addNote = (u: TestUser, s: string) => gql(u, `mutation($s: String!) { createNote(slug: $s, input: { title: "Page" }) { id } }`, { s });
const addCollection = (u: TestUser, s: string) =>
	gql(u, `mutation($s: String!) { createBookmarkCollection(slug: $s, input: { name: "Refs" }) { id } }`, { s });

test("role table: notes, bookmarks and collections outside projects", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const users = {
		owner,
		moderator: await joinAs(owner, slug, "moderator"),
		member: await joinAs(owner, slug, "member"),
		guest: await joinAs(owner, slug, "guest"),
	};
	// things someone else made, for the "anyone's" row
	const author = await joinAs(owner, slug, "member");

	for (const [role, user] of Object.entries(users)) {
		const adds = can(role, "workspaceContent");
		assert.equal(allowed(await addBookmark(user, slug, `${role} link`)), adds, `${role}: add a bookmark`);
		assert.equal(allowed(await addNote(user, slug)), adds, `${role}: add a page`);
		assert.equal(allowed(await addCollection(user, slug)), adds, `${role}: add a collection`);

		const manages = can(role, "manageAllContent");
		const bookmark = (await addBookmark(author, slug, "theirs")).data?.createBookmark.id;
		const note = (await addNote(author, slug)).data?.createNote.id;
		const collection = (await addCollection(author, slug)).data?.createBookmarkCollection.id;
		const vars = (id: string) => ({ s: slug, id });
		assert.equal(allowed(await gql(user, `mutation($s: String!, $id: ID!) { deleteBookmark(slug: $s, id: $id) }`, vars(bookmark))), manages, `${role}: delete someone's bookmark`);
		assert.equal(allowed(await gql(user, `mutation($s: String!, $id: ID!) { deleteNote(slug: $s, id: $id) }`, vars(note))), manages, `${role}: delete someone's page`);
		assert.equal(
			allowed(await gql(user, `mutation($s: String!, $id: ID!) { deleteBookmarkCollection(slug: $s, id: $id) }`, vars(collection))),
			manages,
			`${role}: delete someone's collection`,
		);
	}
});

test("project access table: each right allows exactly its rows", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const projectId = (await gql(owner, WS, { s: slug })).data?.workspace.projects[0].id;
	// private, so a member's only way in is the right they're given
	await gql(owner, `mutation($s: String!, $p: ID!) { setProjectAccess(slug: $s, projectId: $p, access: "private") { id } }`, { s: slug, p: projectId });
	const task = (await gql(owner, `mutation($s: String!, $p: ID!) { createTask(slug: $s, input: { projectId: $p, title: "Seed" }) { id } }`, { s: slug, p: projectId })).data
		?.createTask.id;
	assert.ok(task);

	// one real action per row of PROJECT_ABILITIES, in the same order
	const actions: ((u: TestUser) => Promise<Res>)[] = [
		(u) => gql(u, `query($s: String!, $p: ID!) { workspace(slug: $s) { project(id: $p) { id } } }`, { s: slug, p: projectId }),
		(u) => gql(u, `mutation($s: String!, $t: ID!) { addComment(slug: $s, taskId: $t, text: "Hi") { id } }`, { s: slug, t: task }),
		(u) => gql(u, `mutation($s: String!, $p: ID!) { createTask(slug: $s, input: { projectId: $p, title: "New" }) { id } }`, { s: slug, p: projectId }),
		(u) => gql(u, `mutation($s: String!, $p: ID!) { renameProject(slug: $s, projectId: $p, title: "Renamed") { id } }`, { s: slug, p: projectId }),
		(u) => gql(u, `mutation($s: String!, $p: ID!) { setProjectAccess(slug: $s, projectId: $p, access: "private") { id } }`, { s: slug, p: projectId }),
	];
	assert.equal(actions.length, PROJECT_ABILITIES.length, "every row has an action");

	for (const right of PROJECT_RIGHTS) {
		const member = await joinAs(owner, slug, "member");
		const memberId = (await gql(member, WS, { s: slug })).data?.workspace.members.find((m: { isMe: boolean }) => m.isMe).id;
		const shared = await gql(owner, `mutation($s: String!, $p: ID!, $m: ID!, $r: String!) { shareProject(slug: $s, projectId: $p, memberId: $m, permission: $r) }`, {
			s: slug,
			p: projectId,
			m: memberId,
			r: right,
		});
		assert.equal(allowed(shared), true, JSON.stringify(shared.errors));
		for (const [i, ability] of PROJECT_ABILITIES.entries()) {
			const res = await actions[i]?.(member);
			const ok = !!res && allowed(res) && !(i === 0 && !res.data?.workspace?.project);
			assert.equal(ok, hasRight(right, ability.needs), `${right}: ${ability.label}`);
		}
	}
});
