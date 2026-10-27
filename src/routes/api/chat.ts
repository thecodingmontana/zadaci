import {
	chat,
	chatParamsFromRequest,
	maxIterations,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { scrubSecrets } from "@tanstack/ai/byok";
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";
import { createFileRoute } from "@tanstack/react-router";
import { findWorkspaces } from "#/graphql/schema.server";
import { MAX_MESSAGE } from "#/lib/ai/approval-tools";
import { type ActiveKey, activeKey } from "#/lib/ai/keys.server";
import {
	dailyLimit,
	lastUserText,
	refundMessage,
	takeMessage,
	userClock,
} from "#/lib/ai/limits.server";
import { adapterFor, aiKey, ownAdapter } from "#/lib/ai/model.server";
import { MORE_TOOLS } from "#/lib/ai/more-tools.server";
import { assistantThread, systemPrompt } from "#/lib/ai/prompt";
import { providerOf } from "#/lib/ai/providers";
import { type Chunk, giveUp, rotate, runError } from "#/lib/ai/rotation";
import {
	candidates,
	recordFailure,
	recordSuccess,
} from "#/lib/ai/rotation.server";
import {
	awaitingApproval,
	chatStore,
	threadOwner,
} from "#/lib/ai/store.server";
import { READ_TOOLS } from "#/lib/ai/tools.server";
import { WRITE_TOOLS } from "#/lib/ai/write-tools.server";
import { auth } from "#/lib/auth";
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

// when it's the person's own key that failed, say so, and where to fix it
/** When it's the person's own key that failed, say so and where to fix it, never echoing the key. */
const ownKeyError = (chunk: Chunk, own: ActiveKey) => {
	if (chunk.type !== "RUN_ERROR") return chunk;
	const label = providerOf(own.provider)?.label ?? "Your AI provider";
	if (chunk.code === "auth" || chunk.code === "billing")
		return runError(
			`${label} didn't accept your API key, or the account has no credit. Check it in Settings → Zad.`,
			String(chunk.code),
		);
	if (chunk.code === "account_limit" || chunk.code === "rate_limit")
		return runError(
			`Your ${label} key has hit its limit for now. Try again later, or add credit with ${label}.`,
			String(chunk.code),
		);
	return {
		...chunk,
		message: scrubSecrets(String(chunk.message ?? ""), [own.key]),
		rawEvent: undefined,
	};
};

// the most a chat's history may weigh (about 30 long messages with their tool results)
const MAX_HISTORY = 200_000;

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			// a saved conversation, for the person who owns it
			GET: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return json(401, "Sign in to use Zad");
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
				if (!session) return json(401, "Sign in to use Zad");
				// the person's own key (any provider), when they've chosen one
				const own = await activeKey(session.user.id);
				if (!aiKey() && !own) return json(503, "Zad isn't set up yet");
				const params = await chatParamsFromRequest(request);
				const slug = String(
					(params.forwardedProps as { slug?: unknown } | undefined)?.slug ?? "",
				);
				const [workspace] = await findWorkspaces(session.user.id, slug);
				if (!workspace) return json(404, "Workspace not found");
				const { timeZone, today } = await userClock(session.user.id);
				// one chat per person per workspace, whatever thread the browser names
				const threadId = assistantThread(workspace.id, session.user.id);
				const text = lastUserText(params.messages);
				if (text && text.length > MAX_MESSAGE)
					return sseError(
						`Messages can be up to ${MAX_MESSAGE} characters. Try a shorter one.`,
						"too_long",
					);
				// the browser sends the whole chat; cap all of it, not just the newest message
				if (JSON.stringify(params.messages).length > MAX_HISTORY)
					return sseError(
						"This chat is too long to continue. Clear the history and start again.",
						"too_long",
					);
				// every request counts except an approval answer, which continues the last message;
				// the browser only claims that, so it's free only while the saved chat really waits on one.
				// Only the shared key is limited, your own key is yours to spend
				const answering =
					!!params.resume?.length &&
					(await awaitingApproval(threadId, session.user.id));
				const counted = !own && !answering;
				if (counted && !(await takeMessage(session.user.id, today)))
					return sseError(
						`You've used today's ${dailyLimit()} free messages. Add your own key in Settings → Zad to keep going, or come back tomorrow.`,
						"daily_limit",
					);
				// Claude, ChatGPT and Gemini keys use the model the person picked; OpenRouter (theirs or
				// the shared one) rotates free models unless they named one
				const viaRouter = !own || own.provider === "openrouter";
				const models = !viaRouter
					? [own.model]
					: own?.model
						? [own.model]
						: await candidates(!!own);
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
							adapter:
								own && own.provider !== "openrouter"
									? ownAdapter(own.provider, first, own.key)
									: adapterFor(first, fallbacks, own?.key ?? aiKey()),
							messages: params.messages,
							threadId,
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
							tools: [...READ_TOOLS, ...WRITE_TOOLS, ...MORE_TOOLS],
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
						for await (const chunk of rotate(models, {
							start,
							// cooldowns and stats are about OpenRouter's free models only
							onFailure: (m, f) =>
								viaRouter ? recordFailure(m, f, !!own) : undefined,
							onSuccess: (m, info) => {
								answered = true;
								return viaRouter ? recordSuccess(m, info) : undefined;
							},
						}))
							yield own ? ownKeyError(chunk, own) : chunk;
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
