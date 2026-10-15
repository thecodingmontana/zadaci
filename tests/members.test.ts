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

const STATS = `query($s: String!) { workspace(slug: $s) { role members { id isMe role } teams { id name } memberStats { memberId teamIds activeProjects } } }`;
const CREATE_TEAM = `mutation($s: String!, $i: TeamInput!) { createTeam(slug: $s, input: $i) { id } }`;
const team = (name: string, memberIds: string[]) => ({ name, icon: "icon-[solar--code-linear]", color: "teal", memberIds });

test("an emailed invite decides the role and team someone joins with", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const { slug, inviteCode } = await makeWorkspace(owner);
	const created = await gql(owner, CREATE_TEAM, { s: slug, i: team("Design", []) });
	const teamId = created.data?.createTeam.id;
	await gql(owner, `mutation($s: String!, $e: [String!]!, $t: ID) { inviteMembers(slug: $s, emails: $e, role: "moderator", teamId: $t) { id } }`, {
		s: slug,
		e: [pat.email],
		t: teamId,
	});
	await join(pat, inviteCode);
	const view = (await gql(pat, STATS, { s: slug })).data?.workspace;
	assert.equal(view.role, "moderator");
	const me = view.members.find((m: { isMe: boolean }) => m.isMe);
	assert.deepEqual(view.memberStats.find((s: { memberId: string }) => s.memberId === me.id).teamIds, [teamId]);
});

test("everyone has one primary team, and team names are unique", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const meId = (await gql(owner, STATS, { s: slug })).data?.workspace.members[0].id;
	await gql(owner, CREATE_TEAM, { s: slug, i: team("Design", [meId]) });
	const eng = await gql(owner, CREATE_TEAM, { s: slug, i: team("Engineering", [meId]) });
	const stats = (await gql(owner, STATS, { s: slug })).data?.workspace.memberStats[0];
	assert.deepEqual(stats.teamIds, [eng.data?.createTeam.id], "moved out of Design");
	const dup = await gql(owner, CREATE_TEAM, { s: slug, i: team("design", []) });
	assert.match(dup.errors?.[0]?.message ?? "", /already exists/);
});

test("members can't manage teams", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const res = await gql(member, CREATE_TEAM, { s: slug, i: team("Ops", []) });
	assert.equal(res.errors?.[0]?.extensions?.code, "FORBIDDEN");
});

test("removing someone takes them off projects and teams", async () => {
	const { db, tables } = await import("#/db");
	const { and, eq, isNull } = await import("drizzle-orm");
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id } } }`, { s: slug })).data?.workspace;
	const memberId = ws.members.find((m: { isMe: boolean }) => !m.isMe).id;
	await db.insert(tables.project_members).values({ project_id: ws.projects[0].id, member_id: memberId });
	await gql(owner, CREATE_TEAM, { s: slug, i: team("Ops", [memberId]) });
	await gql(owner, `mutation($s: String!, $m: ID!) { removeMember(slug: $s, memberId: $m) }`, { s: slug, m: memberId });
	for (const t of [tables.project_members, tables.team_members]) {
		const live = await db.select().from(t).where(and(eq(t.member_id, memberId), isNull(t.deleted_at)));
		assert.equal(live.length, 0);
	}
});
