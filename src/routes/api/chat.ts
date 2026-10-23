import {
	chat,
	chatParamsFromRequest,
	maxIterations,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { findWorkspaces } from "#/graphql/schema.server";
import {
	adapterFor,
	aiKey,
	FREE_ROUTER,
	pinnedModel,
} from "#/lib/ai/model.server";
import { systemPrompt } from "#/lib/ai/prompt";
import { READ_TOOLS } from "#/lib/ai/tools.server";
import { auth } from "#/lib/auth";
import { localClock } from "#/lib/daily.server";

// The assistant: streams the model's answer for the signed-in person, inside one workspace.

const json = (status: number, error: string) =>
	Response.json({ error }, { status });

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return json(401, "Sign in to use the assistant");
				if (!aiKey()) return json(503, "The assistant isn't set up yet");
				const params = await chatParamsFromRequest(request);
				const slug = String(
					(params.forwardedProps as { slug?: unknown } | undefined)?.slug ?? "",
				);
				const [workspace] = await findWorkspaces(session.user.id, slug);
				if (!workspace) return json(404, "Workspace not found");
				const [me] = await db
					.select({ prefs: tables.user.preferences })
					.from(tables.user)
					.where(eq(tables.user.id, session.user.id));
				const prefs = (me?.prefs ?? {}) as { tz?: string; autoTz?: string };
				const timeZone = prefs.tz || prefs.autoTz || "UTC";
				const stream = chat({
					adapter: adapterFor(pinnedModel() ?? FREE_ROUTER),
					messages: params.messages,
					threadId: params.threadId,
					runId: params.runId,
					systemPrompts: [
						systemPrompt({
							name: session.user.name,
							workspace: workspace.name,
							timeZone,
						}),
					],
					tools: READ_TOOLS,
					// tools run as this person, in this workspace
					context: {
						user: session.user,
						slug,
						today: localClock(timeZone, new Date()).day,
					},
					// at most 6 model turns (each can call tools) per message
					agentLoopStrategy: maxIterations(6),
				});
				return toServerSentEventsResponse(stream);
			},
		},
	},
});
