import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { mcpResponse } from "#/lib/mcp.server";
import { connectAgent } from "./agent";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

// AI agents use Zadaci through /api/mcp as the person who connected them: their role, their name.
let id = 0;
async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}) {
	const res = await mcpResponse(
		new Request("http://localhost:3000/api/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				"mcp-protocol-version": "2025-06-18",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
		}),
	);
	return { status: res.status, headers: res.headers, body: res.status === 200 ? await res.json() : null };
}
const callTool = async (token: string, name: string, args: Record<string, unknown>) => {
	const { body } = await rpc(token, "tools/call", { name, arguments: args });
	const result = body?.result as { content: { text: string }[]; isError?: boolean };
	return { isError: !!result?.isError, data: JSON.parse(result?.content?.[0]?.text ?? "null") };
};

test("mcp: without a valid sign-in an agent gets pointed to it, and a forged token gets nothing", async () => {
	const none = await rpc(null, "tools/list");
	assert.equal(none.status, 401);
	assert.match(none.headers.get("www-authenticate") ?? "", /resource_metadata=".*\/\.well-known\/oauth-protected-resource"/);

	const me = await makeUser("forger", false);
	const { token } = await connectAgent(me.cookie);
	const [h, p, s] = token.split(".");
	const claims = JSON.parse(Buffer.from(p ?? "", "base64url").toString());
	const forged = Buffer.from(JSON.stringify({ ...claims, sub: "someone-else" })).toString("base64url");
	assert.equal((await rpc(`${h}.${forged}.${s}`, "tools/list")).status, 401, "a changed token fails its signature");
	assert.equal((await rpc("not.a.token", "tools/list")).status, 401);
});

test("mcp: an agent works as the person, with their role, and its changes are simply theirs", async () => {
	const owner = await makeUser("mcp-owner", false);
	const guest = await makeUser("mcp-guest", false);
	const { slug, inviteCode } = await makeWorkspace(owner);
	await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`, { s: slug, e: [guest.email] });
	await join(guest, inviteCode);
	const ownerAgent = (await connectAgent(owner.cookie)).token;
	const guestAgent = (await connectAgent(guest.cookie)).token;

	// on connecting, the agent learns what Zadaci is and who made it
	const hello = await rpc(ownerAgent, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
	assert.ok(hello.body?.result?.serverInfo?.icons?.[0]?.src?.endsWith("/android-chrome-512x512.png"), "it shows Zadaci's logo");
	assert.equal(hello.body?.result?.serverInfo?.title, "Zadaci");
	assert.match(hello.body?.result?.instructions ?? "", /collaborative project and task manager[\s\S]*codewithmontana/);

	const tools = (await rpc(ownerAgent, "tools/list")).body?.result?.tools as { name: string; inputSchema: { required?: string[] } }[];
	assert.ok(tools.some((t) => t.name === "listWorkspaces"));
	assert.ok(tools.find((t) => t.name === "createTask")?.inputSchema.required?.includes("workspace"), "tools take a workspace");

	const spaces = await callTool(ownerAgent, "listWorkspaces", {});
	assert.ok((spaces.data.data.workspaces as { slug: string }[]).some((w) => w.slug === slug));

	const projects = await callTool(ownerAgent, "listProjects", { workspace: slug });
	const projectId = projects.data.projects?.[0]?.id ?? projects.data[0]?.id;
	assert.ok(projectId, JSON.stringify(projects.data));
	const made = await callTool(ownerAgent, "createTask", { workspace: slug, projectId, title: "Wire up the MCP server" });
	assert.equal(made.isError, false, JSON.stringify(made.data));
	const [task] = await db.select({ id: tables.task.id }).from(tables.task).where(and(eq(tables.task.project_id, projectId), eq(tables.task.name, "Wire up the MCP server")));
	assert.ok(task, "the task exists");
	const log = await db.select({ via: tables.activity.via }).from(tables.activity).where(eq(tables.activity.task_id, task.id));
	assert.ok(log.length && log.every((l) => !l.via), "logged as the person, not 'via assistant'");

	// a guest's agent can do only what the guest can: the project isn't theirs to change
	const blocked = await callTool(guestAgent, "createTask", { workspace: slug, projectId, title: "Sneaky" });
	assert.equal(blocked.isError, true);
});

test("mcp: disconnecting an agent stops it at once", async () => {
	const me = await makeUser("mcp-revoker", false);
	const { token, clientId } = await connectAgent(me.cookie);
	assert.equal((await rpc(token, "tools/list")).status, 200);
	await db.delete(tables.oauthConsent).where(and(eq(tables.oauthConsent.userId, me.id), eq(tables.oauthConsent.clientId, clientId)));
	assert.equal((await rpc(token, "tools/list")).status, 401, "the token still looks valid, but the approval is gone");
});
