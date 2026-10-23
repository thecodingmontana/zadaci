import { useQuery } from "@apollo/client/react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useModKey } from "#/components/shell/command-menu";
import { TASKS } from "#/graphql/operations";
import { APPROVAL_TOOLS } from "#/lib/ai/approval-tools";
import { PRIORITIES, taskStatus } from "#/lib/tasks";
import { cn } from "#/lib/utils";

// The assistant's chat: your messages, its streamed answers, and what it did with tools.

export const MAX_MESSAGE = 2000;

/** What each tool call reads as in the chat. */
const TOOL_LABEL: Record<string, string> = {
	searchItems: "Searched the workspace",
	listTasks: "Looked at tasks",
	listProjects: "Looked at projects",
	getItem: "Opened an item",
	createTask: "Created a task",
	updateTask: "Updated tasks",
	addTag: "Added a tag",
	bulkUpdateTasks: "Updated tasks",
	moveTask: "Moved a task",
	addComment: "Added a comment",
	createNote: "Created a note",
	deleteTasks: "Deleted tasks",
};

const SUGGESTIONS = [
	"What's due this week?",
	"Plan my week",
	"Add a task to send the invoice on Friday",
];

export function AssistantChat({
	slug,
	threadId,
	onSaved,
}: {
	slug: string;
	threadId: string;
	/** a message was saved: the chat list can refresh */
	onSaved?: () => void;
}) {
	const mod = useModKey();
	const [text, setText] = useState("");
	const list = useRef<HTMLDivElement>(null);
	const {
		messages,
		sendMessage,
		isLoading,
		error,
		stop,
		reload,
		interrupts,
		resuming,
	} = useChat({
		connection: fetchServerSentEvents("/api/chat"),
		threadId,
		// the server keeps the conversation; opening a chat loads it back
		persistence: true,
		onFinish: () => onSaved?.(),
		forwardedProps: { slug },
		tools: APPROVAL_TOOLS,
	});
	// keep the newest words in view while the answer streams
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every new chunk
	useEffect(() => {
		list.current?.scrollTo({ top: list.current.scrollHeight });
	}, [messages]);

	const send = (value: string) => {
		const body = value.trim();
		if (!body || isLoading || body.length > MAX_MESSAGE) return;
		setText("");
		void sendMessage(body);
	};
	const submit = (e: FormEvent) => {
		e.preventDefault();
		send(text);
	};

	return (
		<div className="ai-chat">
			<div className="ai-msgs" ref={list} aria-live="polite">
				{!messages.length && (
					<div className="ai-empty">
						<h2>How can I help?</h2>
						<p className="faint">
							Ask about your tasks, notes and bookmarks, or tell me what to
							change.
						</p>
						<div className="ai-sugg">
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() => send(s)}
								>
									{s}
								</button>
							))}
						</div>
					</div>
				)}
				{messages.map((m) => (
					<div
						key={m.id}
						className={cn("ai-msg", m.role === "user" ? "me" : "bot")}
					>
						{m.parts.map((part, i) => {
							const key = `${m.id}-${i}`;
							if (part.type === "text")
								return !part.content.trim() ? null : (
									<div key={key} className="ai-text">
										{part.content}
									</div>
								);
							if (part.type === "tool-call")
								return (
									<div key={key} className="ai-tool">
										<span
											className="icon-[solar--widget-4-linear] size-3.5"
											aria-hidden="true"
										/>
										{TOOL_LABEL[part.name] ?? part.name}
									</div>
								);
							return null;
						})}
					</div>
				))}
				{interrupts.map((it) =>
					it.kind === "tool-approval" ? (
						<Approval
							key={it.id}
							slug={slug}
							tool={it.toolName}
							args={it.originalArgs as ApprovalArgs}
							busy={!it.canResolve || resuming}
							onAnswer={(ok) => it.resolveInterrupt(ok)}
						/>
					) : null,
				)}
				{isLoading && <div className="ai-thinking faint">Thinking…</div>}
				{error && (
					<div className="ai-error" role="alert">
						<span>{error.message || "The assistant couldn't answer."}</span>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => void reload()}
						>
							Try again
						</button>
					</div>
				)}
			</div>
			<form className="ai-input" onSubmit={submit}>
				<textarea
					value={text}
					rows={2}
					maxLength={MAX_MESSAGE}
					placeholder="Ask or tell the assistant…"
					aria-label="Message the assistant"
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send(text);
						}
					}}
				/>
				<div className="row">
					<span className="faint" style={{ fontSize: 11 }}>
						Free AI models may log prompts. Don't share anything sensitive.
					</span>
					<span className="sp" />
					<span className="faint hide-m" style={{ fontSize: 11 }}>
						Enter to send · {mod}+J to open
					</span>
					{isLoading ? (
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={stop}
						>
							Stop
						</button>
					) : (
						<button
							type="submit"
							className="btn btn-primary btn-sm"
							disabled={!text.trim()}
						>
							Send
						</button>
					)}
				</div>
			</form>
		</div>
	);
}

type ApprovalArgs = {
	taskIds?: string[];
	status?: string;
	priority?: string;
	dueDate?: string | null;
	addTags?: string[];
};

/** "Approve this?" for deletes and bulk changes: which tasks, and exactly what changes. */
function Approval({
	slug,
	tool,
	args,
	busy,
	onAnswer,
}: {
	slug: string;
	tool: string;
	args: ApprovalArgs;
	busy: boolean;
	onAnswer: (approved: boolean) => void;
}) {
	const { data } = useQuery(TASKS, { variables: { slug } });
	const names = new Map(
		(data?.workspace?.tasks ?? []).map((t) => [t.id, `${t.key} ${t.name}`]),
	);
	const ids = args.taskIds ?? [];
	const lines =
		tool === "deleteTasks"
			? ["Delete these tasks (you can restore them later)"]
			: [
					args.status && `Status → ${taskStatus(args.status).name}`,
					args.priority &&
						`Priority → ${PRIORITIES.find((p) => p.id === args.priority)?.name ?? args.priority}`,
					args.dueDate !== undefined && `Due date → ${args.dueDate ?? "none"}`,
					args.addTags?.length && `Add tags: ${args.addTags.join(", ")}`,
				].filter((l): l is string => !!l);
	return (
		<fieldset
			className="ai-approve"
			aria-label="Approve the assistant's change"
		>
			<div className="ai-approve-h">
				<span
					className="icon-[solar--shield-warning-linear] size-4"
					aria-hidden="true"
				/>
				{tool === "deleteTasks" ? "Delete" : "Change"} {ids.length}{" "}
				{ids.length === 1 ? "task" : "tasks"}?
			</div>
			<ul>
				{lines.map((l) => (
					<li key={l}>{l}</li>
				))}
			</ul>
			<ul className="ai-approve-tasks">
				{ids.slice(0, 12).map((id) => (
					<li key={id}>{names.get(id) ?? id}</li>
				))}
				{ids.length > 12 && (
					<li className="faint">and {ids.length - 12} more</li>
				)}
			</ul>
			<div className="row" style={{ gap: 6 }}>
				<button
					type="button"
					className="btn btn-primary btn-sm"
					disabled={busy}
					onClick={() => onAnswer(true)}
				>
					Approve
				</button>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					disabled={busy}
					onClick={() => onAnswer(false)}
				>
					Cancel
				</button>
			</div>
		</fieldset>
	);
}
