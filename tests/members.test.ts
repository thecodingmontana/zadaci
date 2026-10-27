import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
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

test("invites can't be resent every second, and a member can't revive an admin invite", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const email = `alice-${Date.now()}@example.com`;
	const invited = await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "moderator") { id } }`, { s: slug, e: [email] });
	const id = invited.data?.inviteMembers[0].id;
	const resend = await gql(owner, `mutation($s: String!, $id: ID!) { resendInvite(slug: $s, id: $id) }`, { s: slug, id });
	assert.match(resend.errors?.[0]?.message ?? "", /just sent/);

	// the admin invite expires; a member then shares a project of theirs with the same email
	await db.update(tables.workspace_invite_request).set({ expires_at: new Date(Date.now() - 1000) }).where(eq(tables.workspace_invite_request.id, id));
	const project = (
		await gql(member, `mutation($s: String!, $i: ProjectInput!) { createProject(slug: $s, input: $i) { id } }`, {
			s: slug,
			i: { title: "Side project", icon: "icon-[solar--global-linear]", color: "teal", template: "blank" },
		})
	).data?.createProject;
	const shared = await gql(member, `mutation($s: String!, $p: ID!, $e: String!) { inviteToProject(slug: $s, projectId: $p, email: $e, permission: "view") }`, { s: slug, p: project.id, e: email });
	assert.ok(shared.data?.inviteToProject, JSON.stringify(shared.errors));
	const [old] = await db.select().from(tables.workspace_invite_request).where(eq(tables.workspace_invite_request.id, id));
	assert.ok(old && old.expires_at && old.expires_at.getTime() < Date.now(), "the admin invite stays expired");
	const fresh = await db.select({ role: tables.workspace_invite_request.role }).from(tables.workspace_invite_request).where(eq(tables.workspace_invite_request.email, email));
	assert.ok(fresh.some((r) => r.role === "guest"), "a separate guest invite was made");
});

test("team lists carry their member and project counts", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const me = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug })).data?.workspace.members.find((m: { isMe: boolean }) => m.isMe).id;
	await gql(owner, CREATE_TEAM, { s: slug, i: team("Design", [me]) });
	const teams = (await gql(owner, `query($s: String!) { workspace(slug: $s) { teams { name memberCount projectCount } } }`, { s: slug })).data?.workspace.teams;
	assert.deepEqual(teams, [{ name: "Design", memberCount: 1, projectCount: 0 }]);
});

test("invite emails share one daily budget per person, so a new workspace doesn't reset it", async () => {
	const owner = await makeUser("owner");
	const key = `invite-emails:${owner.id}`;
	// 99 of the day's 100 already sent
	await db.insert(tables.rateLimit).values({ id: key, key, count: 99, lastRequest: Date.now() });
	const invite = (slug: string, emails: string[]) =>
		gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "member") { id } }`, { s: slug, e: emails });
	const first = await makeWorkspace(owner);
	const second = await makeWorkspace(owner);
	try {
		assert.match((await invite(first.slug, ["a1@example.com", "a2@example.com"])).errors?.[0]?.message ?? "", /invite emails a day/);
		assert.match((await invite(second.slug, ["b1@example.com", "b2@example.com"])).errors?.[0]?.message ?? "", /invite emails a day/);
		assert.equal((await invite(second.slug, ["b1@example.com"])).data?.inviteMembers.length, 1);
		assert.match((await invite(first.slug, ["a1@example.com"])).errors?.[0]?.message ?? "", /invite emails a day/);
	} finally {
		await db.delete(tables.rateLimit).where(eq(tables.rateLimit.key, key));
	}
});

const PREVIEW = `query($c: String!) { invitePreview(code: $c) { workspace inviter role email forYou joinedSlug members } }`;

test("an invite link shows the workspace first; declining turns the invite down for good and tells the sender", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const stranger = await makeUser("stranger");
	const { slug, inviteCode } = await makeWorkspace(owner);
	const sent = await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "member") { id } }`, { s: slug, e: [pat.email] });
	const id = sent.data?.inviteMembers[0].id;

	const seen = (await gql(pat, PREVIEW, { c: id })).data?.invitePreview;
	assert.deepEqual(
		{ forYou: seen.forYou, inviter: seen.inviter, role: seen.role, email: seen.email, joinedSlug: seen.joinedSlug, members: seen.members },
		{ forYou: true, inviter: "owner", role: "member", email: pat.email, joinedSlug: null, members: 1 },
	);
	// opening it doesn't join anyone
	assert.equal((await gql(pat, `query($s: String!) { workspace(slug: $s) { id } }`, { s: slug })).data?.workspace, null);
	assert.equal((await gql(stranger, PREVIEW, { c: id })).data?.invitePreview.forYou, false);
	assert.match((await gql(stranger, `mutation($c: String!) { declineInvite(code: $c) }`, { c: id })).errors?.[0]?.message ?? "", /sent to/);

	assert.equal((await gql(pat, `mutation($c: String!) { declineInvite(code: $c) }`, { c: id })).data?.declineInvite, true);
	assert.equal((await gql(pat, PREVIEW, { c: id })).data?.invitePreview, null, "a declined invite no longer opens");
	assert.match((await join(pat, id)).errors?.[0]?.message ?? "", /isn't valid anymore/);
	const notes = await db.select({ text: tables.notification.text }).from(tables.notification).where(eq(tables.notification.user_id, owner.id));
	assert.ok(notes.some((n) => n.text.startsWith("declined your invite")), "the sender hears back");

	// the shared link previews too, and someone already in sees where to go
	assert.equal((await gql(stranger, PREVIEW, { c: inviteCode })).data?.invitePreview.forYou, true);
	assert.equal((await gql(owner, PREVIEW, { c: inviteCode })).data?.invitePreview.joinedSlug, slug);
});
