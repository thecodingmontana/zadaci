import type { ModelMessage } from "@tanstack/ai";
import { defineMessageStore } from "@tanstack/ai-persistence";
import { and, asc, eq } from "drizzle-orm";
import { db, tables } from "#/db";

// Where the assistant's chats are saved: TanStack AI's persistence middleware hands us the
// whole transcript of a thread, and we keep it in our own Postgres tables, one row per message.

/** The thread's owner, or null when nobody has saved it yet. */
export async function threadOwner(threadId: string) {
	const [row] = await db
		.select({ userId: tables.ai_conversation.user_id })
		.from(tables.ai_conversation)
		.where(eq(tables.ai_conversation.id, threadId));
	return row?.userId ?? null;
}

const titleOf = (messages: ModelMessage[]) => {
	const first = messages.find((m) => m.role === "user");
	const text =
		typeof first?.content === "string"
			? first.content
			: Array.isArray(first?.content)
				? first.content
						.map((p) =>
							"content" in p && typeof p.content === "string" ? p.content : "",
						)
						.join(" ")
				: "";
	const line = text.replace(/\s+/g, " ").trim();
	return line
		? line.length > 60
			? `${line.slice(0, 60)}…`
			: line
		: "New chat";
};

/**
 * A message store for one person in one workspace. `model` says which model is answering
 * now; it's recorded on assistant messages that don't have one yet.
 */
export function chatStore(opts: {
	userId: string;
	workspaceId: string;
	model: () => string | null;
}) {
	return defineMessageStore({
		async loadThread(threadId: string) {
			if ((await threadOwner(threadId)) !== opts.userId) return [];
			const rows = await db
				.select()
				.from(tables.ai_message)
				.where(eq(tables.ai_message.conversation_id, threadId))
				.orderBy(asc(tables.ai_message.position));
			return rows.map(
				(r) =>
					({
						...((r.extra as object | null) ?? {}),
						role: r.role,
						content: r.content,
						...(r.tool_calls ? { toolCalls: r.tool_calls } : {}),
						...(r.tool_call_id ? { toolCallId: r.tool_call_id } : {}),
					}) as ModelMessage,
			);
		},

		async saveThread(threadId: string, messages: ModelMessage[]) {
			const owner = await threadOwner(threadId);
			// someone else's thread id is never overwritten
			if (owner && owner !== opts.userId) return;
			await db.transaction(async (tx) => {
				await tx
					.insert(tables.ai_conversation)
					.values({
						id: threadId,
						user_id: opts.userId,
						workspace_id: opts.workspaceId,
						title: titleOf(messages),
					})
					.onConflictDoUpdate({
						target: tables.ai_conversation.id,
						set: { updated_at: new Date() },
					});
				const before = await tx
					.select({
						position: tables.ai_message.position,
						model: tables.ai_message.model,
					})
					.from(tables.ai_message)
					.where(
						and(
							eq(tables.ai_message.conversation_id, threadId),
							eq(tables.ai_message.role, "assistant"),
						),
					);
				const modelAt = new Map(before.map((b) => [b.position, b.model]));
				await tx
					.delete(tables.ai_message)
					.where(eq(tables.ai_message.conversation_id, threadId));
				if (!messages.length) return;
				await tx.insert(tables.ai_message).values(
					messages.map((m, position) => {
						const { role, content, toolCalls, toolCallId, ...extra } =
							m as ModelMessage & {
								toolCalls?: unknown;
								toolCallId?: string;
							};
						return {
							conversation_id: threadId,
							user_id: opts.userId,
							position,
							role,
							content: content ?? null,
							tool_calls: toolCalls ?? null,
							tool_call_id: toolCallId ?? null,
							model:
								role === "assistant"
									? (modelAt.get(position) ?? opts.model())
									: null,
							extra: Object.keys(extra).length ? extra : null,
						};
					}),
				);
			});
		},
	});
}
