import { createPublicKey, verify } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { type AiContext, run } from "#/lib/ai/gql.server";
import { userClock } from "#/lib/ai/limits.server";
import { MORE_TOOLS } from "#/lib/ai/more-tools.server";
import { READ_TOOLS } from "#/lib/ai/tools.server";
import { WRITE_TOOLS } from "#/lib/ai/write-tools.server";
import { MCP_RESOURCE } from "#/lib/auth";
import { takeAllowance } from "#/lib/rate-limit.server";

// Zadaci as an MCP server: an AI agent (Claude Code, Cursor, Codex…) that signed in as a person
// over OAuth uses Zad's own tools, as that person, with their role in each workspace. Every
// call goes through the app's GraphQL API, so every permission check applies unchanged.

const ISSUER = new URL(MCP_RESOURCE).origin;

// What an agent knows about Zadaci the moment it connects (MCP clients add this to the model's
// context). Only facts from the README: no made-up numbers or claims.
const ABOUT = `Zadaci (https://zadaci.vercel.app) is a collaborative project and task manager for teams: plan projects in the view that suits the work, keep docs and meeting notes next to them, and share exactly what each person should see. It was designed and built by @codewithmontana (https://x.com/codewithmontana); questions or problems: thecodingmontana@gmail.com.

What it has:
- Workspaces with roles (Owner, Admin, Member, Guest), email invites, invite links and teams.
- Projects with board, list, table, calendar, timeline, files and activity views, saved views, statuses, leads, milestones, and private or workspace-wide sharing.
- Tasks with subtasks, assignees, priorities, labels, due and start dates, estimates, dependencies, repeating tasks, comments with @mentions and reactions, attachments, favorites, bulk edits and time tracking.
- My Tasks, Inbox and Notifications, a workspace activity feed, reminders, a morning email digest and web push.
- Notes (Notion-style pages with blocks, embeds and covers), Bookmarks (links filed in collections) and team Chat (channels, direct messages, threads, project and task chats).
- Zad, the built-in assistant; and this MCP server, so outside AI agents can work in Zadaci too.

How to work here: you act as the signed-in person, with exactly their role in each workspace (you can't do anything they can't). Start with listWorkspaces to get a workspace slug; every other tool takes it as "workspace". Use listProjects and searchItems to find ids before changing anything. Your changes are the person's own and show up live for their team.`;
const CALLS_PER_MINUTE = 120;
const b64 = (s: string) => Buffer.from(s, "base64url");

/** The person and app behind an agent's access token, or null if it isn't a live, valid token for /api/mcp. */
export async function verifyAgentToken(token: string) {
	const [h, p, sig] = token.split(".");
	if (!h || !p || !sig) return null;
	let header: { alg?: string; kid?: string };
	let claims: {
		sub?: string;
		azp?: string;
		iss?: string;
		aud?: string | string[];
		exp?: number;
	};
	try {
		header = JSON.parse(b64(h).toString());
		claims = JSON.parse(b64(p).toString());
	} catch {
		return null;
	}
	if (header.alg !== "RS256" || !header.kid) return null;
	const [key] = await db
		.select({ publicKey: tables.jwks.publicKey })
		.from(tables.jwks)
		.where(eq(tables.jwks.id, header.kid));
	if (!key) return null;
	const signed = verify(
		"RSA-SHA256",
		Buffer.from(`${h}.${p}`),
		createPublicKey({ key: JSON.parse(key.publicKey), format: "jwk" }),
		b64(sig),
	);
	if (!signed) return null;
	if (claims.iss !== ISSUER || ![claims.aud].flat().includes(MCP_RESOURCE))
		return null;
	if (!claims.exp || claims.exp * 1000 <= Date.now()) return null;
	if (!claims.sub || !claims.azp) return null;
	// still approved: disconnecting the app deletes the consent, so this stops it at once
	const [consent] = await db
		.select({ id: tables.oauthConsent.id })
		.from(tables.oauthConsent)
		.where(
			and(
				eq(tables.oauthConsent.userId, claims.sub),
				eq(tables.oauthConsent.clientId, claims.azp),
			),
		);
	return consent ? { userId: claims.sub, clientId: claims.azp } : null;
}

// one plain shape for all 25 (the SDK checks each call against the tool's schema before it runs)
type AnyTool = {
	name: string;
	description: string;
	inputSchema?: unknown;
	needsApproval?: unknown;
	execute?: (args: unknown, options: { context: AiContext }) => unknown;
};
const TOOLS = [
	...READ_TOOLS,
	...WRITE_TOOLS,
	...MORE_TOOLS,
] as unknown as AnyTool[];
const READ_ONLY = new Set([...READ_TOOLS.map((t) => t.name), "listMembers"]);
const workspaceArg = z
	.string()
	.min(1)
	.max(64)
	.describe("the workspace's slug, from listWorkspaces");

/** One MCP server for this person's request (stateless: Vercel functions keep no sessions). */
function serverFor(user: AiContext["user"], today: string) {
	const server = new McpServer(
		{ name: "zadaci", version: "1.0.0" },
		{ instructions: ABOUT },
	);
	const ctx = (slug: string): AiContext => ({
		user,
		slug,
		today,
		edited: new Set(),
		asYou: true,
	});
	const reply = (result: unknown) => ({
		content: [{ type: "text" as const, text: JSON.stringify(result) }],
		isError: !!(result && typeof result === "object" && "error" in result),
	});

	server.registerTool(
		"listWorkspaces",
		{
			description:
				"List the Zadaci workspaces you belong to, with their slugs and your role. Every other tool needs a workspace slug.",
			annotations: { readOnlyHint: true },
		},
		async () =>
			reply(await run(ctx(""), `query { workspaces { slug name role } }`)),
	);
	for (const tool of TOOLS) {
		const schema = tool.inputSchema as z.ZodObject<z.ZodRawShape>;
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema: schema.extend({ workspace: workspaceArg }),
				annotations: READ_ONLY.has(tool.name)
					? { readOnlyHint: true }
					: // the ones Zad asks about first: the agent's app asks you instead
						{ readOnlyHint: false, destructiveHint: !!tool.needsApproval },
			},
			async ({ workspace, ...args }) =>
				reply(await tool.execute?.(args, { context: ctx(String(workspace)) })),
		);
	}
	return server;
}

const challenge = (status: number, error: string) =>
	new Response(JSON.stringify({ error }), {
		status,
		headers: {
			"content-type": "application/json",
			// tells the agent where to sign in (RFC 9728)
			"www-authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"${status === 401 ? `, error="invalid_token"` : ""}`,
		},
	});

/** POST /api/mcp: one MCP request from a signed-in agent. */
export async function mcpResponse(request: Request) {
	const token = request.headers
		.get("authorization")
		?.match(/^Bearer (.+)$/i)?.[1];
	const who = token ? await verifyAgentToken(token) : null;
	if (!who) return challenge(401, "Sign in to Zadaci first");
	if (!(await takeAllowance(`mcp:${who.userId}`, 1, CALLS_PER_MINUTE, 60_000)))
		return challenge(429, "Too many requests. Slow down for a minute.");
	const [user] = await db
		.select({
			id: tables.user.id,
			email: tables.user.email,
			name: tables.user.name,
		})
		.from(tables.user)
		.where(eq(tables.user.id, who.userId));
	if (!user) return challenge(401, "That account is gone");
	const server = serverFor(user, (await userClock(user.id)).today);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}
