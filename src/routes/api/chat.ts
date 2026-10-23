import {
	chat,
	chatParamsFromRequest,
	maxIterations,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";
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
import { chatStore, threadOwner } from "#/lib/ai/store.server";
import { READ_TOOLS } from "#/lib/ai/tools.server";
import { WRITE_TOOLS } from "#/lib/ai/write-tools.server";
import { auth } from "#/lib/auth";
import { localClock } from "#/lib/daily.server";

// The assistant: streams the model's answer for the signed-in person, inside one workspace.

const json = (status: number, error: string) =>
	Response.json({ error }, { status });

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			// a saved conversation, for the person who owns it
			GET: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return json(401, "Sign in to use the assistant");
				const store = chatStore({
					userId: session.user.id,
					workspaceId: "",
					model: () => null,
				});
				return reconstructChat({ stores: { messages: store } }, request, {
					authorize: async (threadId) => {
						const owner = await threadOwner(threadId);
						return !owner || owner === session.user.id;
					},
				});
			},
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
				const model = pinnedModel() ?? FREE_ROUTER;
				const owner = params.threadId
					? await threadOwner(params.threadId)
					: null;
				if (owner && owner !== session.user.id)
					return json(404, "Conversation not found");
				const persistence = {
					stores: {
						messages: chatStore({
							userId: session.user.id,
							workspaceId: workspace.id,
							model: () => model,
						}),
					},
				};
				const stream = chat({
					adapter: adapterFor(model),
					messages: params.messages,
					threadId: params.threadId,
					runId: params.runId,
					// an approval answer resumes the paused run from the history the browser sends back
					parentRunId: params.parentRunId,
					...(params.resume ? { resume: params.resume } : {}),
					systemPrompts: [
						systemPrompt({
							name: session.user.name,
							workspace: workspace.name,
							timeZone,
						}),
					],
					tools: [...READ_TOOLS, ...WRITE_TOOLS],
					// tools run as this person, in this workspace
					context: {
						user: session.user,
						slug,
						today: localClock(timeZone, new Date()).day,
						edited: new Set<string>(),
					},
					// at most 6 model turns (each can call tools) per message
					agentLoopStrategy: maxIterations(6),
					// saves the conversation as it goes, in our own tables
					middleware: [withPersistence(persistence)],
				});
				return toServerSentEventsResponse(stream);
			},
		},
	},
});
