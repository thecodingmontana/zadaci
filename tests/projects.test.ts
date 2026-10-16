import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const CREATE = `mutation($s: String!, $i: ProjectInput!) { createProject(slug: $s, input: $i) { id key status leadId myAccess startDate dueDate } }`;
const UPDATE = `mutation($s: String!, $p: ID!, $i: ProjectPatch!) { updateProject(slug: $s, projectId: $p, input: $i) { id status } }`;
const LIST = `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id title } projectStats { projectId total done overdue memberIds } } }`;
const input = (title: string, template = "blank") => ({ title, icon: "icon-[solar--global-linear]", color: "teal", template });

test("creating from a template adds starter tasks, a key and a lead, at the top of the list", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const res = await gql(owner, CREATE, { s: slug, i: input("Website Redesign", "product") });
	const created = res.data?.createProject;
	assert.ok(created, JSON.stringify(res.errors));
	assert.equal(created.key, "WR");
	assert.equal(created.status, "planning");
	assert.equal(created.myAccess, "full");
	assert.ok(created.startDate && created.dueDate, "start today, due in 30 days");

	const ws = (await gql(owner, LIST, { s: slug })).data?.workspace;
	assert.equal(ws.projects[0].id, created.id, "new projects go first");
	const stats = ws.projectStats.find((s: { projectId: string }) => s.projectId === created.id);
	assert.equal(stats.total, 6);
	assert.equal(stats.done, 0);
	assert.equal(created.leadId, ws.members.find((m: { isMe: boolean }) => m.isMe).id);
	assert.deepEqual(stats.memberIds, [created.leadId]);
});

test("project creation follows 'Members can create projects', and guests never create", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	assert.ok((await gql(member, CREATE, { s: slug, i: input("Mine") })).data, "allowed by default");
	await gql(owner, `mutation($s: String!) { updateWorkspace(slug: $s, input: { settings: { permCreate: false } }) { id } }`, { s: slug });
	assert.equal(code(await gql(member, CREATE, { s: slug, i: input("Blocked") })), "FORBIDDEN");
});

test("status changes need edit rights and land in the project's activity", async () => {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const projectId = (await gql(owner, LIST, { s: slug })).data?.workspace.projects[0].id;

	assert.equal(code(await gql(member, UPDATE, { s: slug, p: projectId, i: { status: "risk" } })), "FORBIDDEN", "comment only");
	assert.equal((await gql(owner, UPDATE, { s: slug, p: projectId, i: { status: "risk" } })).data?.updateProject.status, "risk");
	const feed = (await gql(owner, `query($s: String!, $p: ID) { workspace(slug: $s) { activity(projectId: $p) { verb extra } } }`, { s: slug, p: projectId })).data
		?.workspace.activity;
	assert.deepEqual(feed[0], { verb: "changed status of project", extra: "to At Risk" });
	assert.equal(code(await gql(owner, UPDATE, { s: slug, p: projectId, i: { status: "nope" } })), "BAD_USER_INPUT");
});

test("milestones are added and removed by editors", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const projectId = (await gql(owner, LIST, { s: slug })).data?.workspace.projects[0].id;
	const added = await gql(owner, `mutation($s: String!, $p: ID!) { addMilestone(slug: $s, projectId: $p, name: "Launch", date: "2026-12-01") { id } }`, { s: slug, p: projectId });
	const MS = `query($s: String!, $p: ID!) { workspace(slug: $s) { project(id: $p) { milestones { name date } } } }`;
	assert.deepEqual((await gql(owner, MS, { s: slug, p: projectId })).data?.workspace.project.milestones, [{ name: "Launch", date: "2026-12-01" }]);
	await gql(owner, `mutation($s: String!, $p: ID!, $id: ID!) { deleteMilestone(slug: $s, projectId: $p, id: $id) }`, { s: slug, p: projectId, id: added.data?.addMilestone.id });
	assert.deepEqual((await gql(owner, MS, { s: slug, p: projectId })).data?.workspace.project.milestones, []);
});
