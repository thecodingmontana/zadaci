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
import { adapterFor, aiKey } from "#/lib/ai/model.server";
import { systemPrompt } from "#/lib/ai/prompt";
import { type Chunk, giveUp, rotate } from "#/lib/ai/rotation";
import {
	candidates,
	recordFailure,
	recordSuccess,
} from "#/lib/ai/rotation.server";
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
				const owner = params.threadId
					? await threadOwner(params.threadId)
					: null;
				if (owner && owner !== session.user.id)
					return json(404, "Conversation not found");
				const models = await candidates();
				// the model answering right now (the router reports the one it really used)
				let model: string | null = null;
				const persistence = {
					stores: {
						messages: chatStore({
							userId: session.user.id,
							workspaceId: workspace.id,
							model: () => model,
						}),
					},
				};
				const start = async function* (
					first: string,
					fallbacks: string[],
				): AsyncIterable<Chunk> {
					model = first;
					for await (const chunk of chat({
						adapter: adapterFor(first, fallbacks),
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
					})) {
						const meta = (
							chunk as { metadata?: { tanstack?: { model?: string } } }
						).metadata?.tanstack?.model;
						if (chunk.type === "RUN_FINISHED" && meta) model = meta;
						yield chunk as Chunk;
					}
				};
				// a failing model hands over to the next one before anything has streamed;
				// with the account out of free requests, nothing is tried
				const stream = models
					? rotate(models, {
							start,
							onFailure: recordFailure,
							onSuccess: recordSuccess,
						})
					: (async function* () {
							yield giveUp("account_limit");
						})();
				return toServerSentEventsResponse(
					stream as Parameters<typeof toServerSentEventsResponse>[0],
				);
			},
		},
	},
});
