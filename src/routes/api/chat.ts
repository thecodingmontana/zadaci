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
import { MAX_MESSAGE } from "#/lib/ai/approval-tools";
import {
	dailyLimit,
	lastUserText,
	refundMessage,
	takeMessage,
} from "#/lib/ai/limits.server";
import { adapterFor, aiKey } from "#/lib/ai/model.server";
import { systemPrompt } from "#/lib/ai/prompt";
import { type Chunk, giveUp, rotate, runError } from "#/lib/ai/rotation";
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
import { drainEmails } from "#/lib/email.server";

// The assistant: streams the model's answer for the signed-in person, inside one workspace.

const json = (status: number, error: string) =>
	Response.json({ error }, { status });

// errors as a stream, so the chat shows them in place with its retry button
const sseError = (message: string, code: string) =>
	toServerSentEventsResponse(
		(async function* () {
			yield runError(message, code);
		})() as Parameters<typeof toServerSentEventsResponse>[0],
	);

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
				const text = lastUserText(params.messages);
				if (text && text.length > MAX_MESSAGE)
					return sseError(
						`Messages can be up to ${MAX_MESSAGE} characters. Try a shorter one.`,
						"too_long",
					);
				const today = localClock(timeZone, new Date()).day;
				// approving a change continues the last message, so it isn't counted again
				const counted = text !== null && !params.resume;
				if (counted && !(await takeMessage(session.user.id, today)))
					return sseError(
						`You've sent ${dailyLimit()} messages to the assistant today, the daily limit. It resets tomorrow.`,
						"daily_limit",
					);
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
					try {
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
								today,
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
					} finally {
						// emails and pushes the tools queued (a comment notifies the task's people)
						await drainEmails();
					}
				};
				// a failing model hands over to the next one before anything has streamed;
				// with the account out of free requests, nothing is tried
				let answered = false;
				const stream = (async function* () {
					if (models)
						yield* rotate(models, {
							start,
							onFailure: recordFailure,
							onSuccess: (m, info) => {
								answered = true;
								return recordSuccess(m, info);
							},
						});
					else yield giveUp("account_limit");
					// a message no model answered doesn't use up the day's allowance
					if (counted && !answered) await refundMessage(session.user.id, today);
				})();
				return toServerSentEventsResponse(
					stream as Parameters<typeof toServerSentEventsResponse>[0],
				);
			},
		},
	},
});
