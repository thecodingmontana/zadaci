import { useQuery } from "@apollo/client/react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AI_STATUS, SHELL, TASKS } from "#/graphql/operations";
import { APPROVAL_TOOLS, MAX_MESSAGE } from "#/lib/ai/approval-tools";
import { providerOf } from "#/lib/ai/providers";
import { PRIORITIES, taskStatus } from "#/lib/tasks";
import { copy } from "#/lib/toast";
import {
	type Item,
	ItemList,
	itemsOf,
	MentionPicker,
	MessageText,
	mentionToken,
	ThinkingCard,
	useOpenItem,
} from "./assistant-parts";

// The assistant's chat: your messages, its streamed answers, and the work behind each one.

const SUGGESTIONS = [
	"What's due this week?",
	"Plan my week",
	"Add a task to send the invoice on Friday",
];

export function AssistantChat({
	slug,
	threadId,
}: {
	slug: string;
	threadId: string;
}) {
	const [text, setText] = useState("");
	const list = useRef<HTMLDivElement>(null);
	const { data: ai, refetch: refetchAi } = useQuery(AI_STATUS);
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
		forwardedProps: { slug },
		tools: APPROVAL_TOOLS,
		// the free allowance shown under the box counts down after each answer
		onFinish: () => void refetchAi(),
		onError: () => void refetchAi(),
	});
	// keep the newest words in view while the answer streams
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every new chunk
	useEffect(() => {
		list.current?.scrollTo({ top: list.current.scrollHeight });
	}, [messages]);

	const openItem = useOpenItem(slug);
	const own = ai?.aiStatus.keys.find((k) => k.active);
	const free =
		ai && !own ? Math.max(0, ai.aiStatus.limit - ai.aiStatus.used) : null;
	const box = useRef<HTMLTextAreaElement>(null);
	// what's typed after "@" (null when no mention is being written)
	const [mention, setMention] = useState<string | null>(null);
	// how long each answer worked, for "Worked for 7s" (answers loaded from history show none)
	const timing = useRef(new Map<string, { start: number; seconds?: number }>());
	// the agent's tool rounds come back as several assistant messages: one turn shows them as one answer
	const turns: (typeof messages)[number][] = [];
	for (const m of messages) {
		const prev = turns.at(-1);
		if (m.role === "assistant" && prev?.role === "assistant")
			turns[turns.length - 1] = {
				...prev,
				parts: [...prev.parts, ...m.parts],
				metadata: m.metadata ?? prev.metadata,
			};
		else turns.push(m);
	}
	const answer = turns.at(-1);
	if (answer?.role === "assistant") {
		const t = timing.current.get(answer.id);
		if (isLoading && !t) timing.current.set(answer.id, { start: Date.now() });
		else if (!isLoading && t && t.seconds === undefined)
			t.seconds = Math.max(1, Math.round((Date.now() - t.start) / 1000));
	}

	const typed = (value: string, caret: number) => {
		setText(value);
		const m = /(?:^|\s)@([^\s@]{0,40})$/.exec(value.slice(0, caret));
		setMention(m ? m[1] : null);
	};
	// what was picked from the @ list: the box shows "@Zadaci", the message carries the id
	const [picked, setPicked] = useState<Item[]>([]);
	const shown = picked.filter((i) => text.includes(`@${i.label}`));
	const pick = (item: Item) => {
		const el = box.current;
		const caret = el?.selectionStart ?? text.length;
		const before = text.slice(0, caret).replace(/@[^\s@]{0,40}$/, "");
		const name = `@${item.label}`;
		setText(`${before}${name} ${text.slice(caret)}`);
		setPicked((list) => [...list.filter((i) => i.id !== item.id), item]);
		setMention(null);
		requestAnimationFrame(() => {
			el?.focus();
			const at = before.length + name.length + 1;
			el?.setSelectionRange(at, at);
		});
	};
	const unpick = (item: Item) => {
		setText((t) =>
			t.replace(`@${item.label} `, "").replace(`@${item.label}`, ""),
		);
		setPicked((list) => list.filter((i) => i.id !== item.id));
	};

	const send = (value: string) => {
		// longest names first, so "@Alpha" never eats part of "@Alpha launch"
		const body = [...shown]
			.sort((a, b) => b.label.length - a.label.length)
			.reduce(
				(t, item) => t.split(`@${item.label}`).join(mentionToken(item)),
				value.trim(),
			);
		if (!body || isLoading || body.length > MAX_MESSAGE) return;
		setText("");
		setPicked([]);
		setMention(null);
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
				{turns.map((m, idx) => {
					const last = idx === turns.length - 1;
					const text = m.parts
						.map((p) => (p.type === "text" ? p.content : ""))
						.join("")
						.trim();
					if (m.role === "user")
						return (
							<div key={m.id} className="ai-msg me">
								<MessageText text={text} onOpen={openItem} />
							</div>
						);
					const calls = m.parts.flatMap((p) =>
						p.type === "tool-call"
							? [
									{
										name: String(p.name),
										input: p.input ?? p.arguments,
										output: p.output,
									},
								]
							: [],
					);
					const live = isLoading && last;
					const time = timing.current.get(m.id);
					const model = m.metadata?.tanstack?.model;
					return (
						<div key={m.id} className="ai-msg bot">
							{calls.length > 0 && (
								<ThinkingCard
									calls={calls}
									live={live}
									startedAt={time?.start}
									seconds={time?.seconds}
									onOpen={openItem}
								/>
							)}
							{text && <MessageText text={text} onOpen={openItem} />}
							{!live && (
								<ItemList
									items={calls
										.filter((c) => c.name !== "searchItems")
										.flatMap(itemsOf)}
									onOpen={openItem}
								/>
							)}
							{!live && text && (
								<div className="ai-acts">
									<button
										type="button"
										className="ibtn ibtn-xs"
										aria-label="Copy"
										data-tip="Copy"
										onClick={() => copy(text, "Answer copied")}
									>
										<span
											className="icon-[solar--copy-linear] size-3.5"
											aria-hidden="true"
										/>
									</button>
									{last && (
										<button
											type="button"
											className="ibtn ibtn-xs"
											aria-label="Answer again"
											data-tip="Answer again"
											onClick={() => void reload()}
										>
											<span
												className="icon-[solar--restart-linear] size-3.5"
												aria-hidden="true"
											/>
										</button>
									)}
									{model && (
										<span className="ai-model faint">
											{String(model).replace(/:free$/, "")}
										</span>
									)}
								</div>
							)}
						</div>
					);
				})}
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
				{isLoading && turns.at(-1)?.role === "user" && (
					<div className="ai-thinking">
						<span className="shim on">Thinking…</span>
					</div>
				)}
				{error && (
					<div className="ai-error" role="alert">
						<span>{error.message || "The assistant couldn't answer."}</span>
						{/free messages|daily limit|API key/i.test(error.message) ? (
							<Link
								to="/w/$slug/settings"
								params={{ slug }}
								search={{ sec: "ai" }}
								className="btn btn-secondary btn-sm"
							>
								Connect a key
							</Link>
						) : (
							<button
								type="button"
								className="btn btn-secondary btn-sm"
								onClick={() => void reload()}
							>
								Try again
							</button>
						)}
					</div>
				)}
			</div>
			<form className="ai-input" onSubmit={submit}>
				{mention !== null && (
					<MentionPicker slug={slug} q={mention} onPick={pick} />
				)}
				{shown.length > 0 && (
					<div className="ai-picked">
						{shown.map((item) => (
							<span key={`${item.kind}-${item.id}`} className="ai-chip">
								<span className="trunc">{item.label}</span>
								<button
									type="button"
									className="ai-unpick"
									aria-label={`Remove ${item.label}`}
									onClick={() => unpick(item)}
								>
									<span
										className="icon-[hugeicons--cancel-01] size-3"
										aria-hidden="true"
									/>
								</button>
							</span>
						))}
					</div>
				)}
				<textarea
					ref={box}
					value={text}
					rows={2}
					maxLength={MAX_MESSAGE}
					placeholder="Ask, or type @ to mention a project, task or note…"
					aria-label="Message the assistant"
					onChange={(e) => typed(e.target.value, e.target.selectionStart)}
					onKeyDown={(e) => {
						if (e.key === "Escape" && mention !== null) {
							e.preventDefault();
							setMention(null);
							return;
						}
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send(text);
						}
					}}
				/>
				<div className="row">
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="Mention a project, task or note"
						data-tip="Mention (@)"
						onClick={() => {
							const el = box.current;
							const caret = el?.selectionStart ?? text.length;
							const lead =
								caret && !/\s$/.test(text.slice(0, caret)) ? " " : "";
							typed(
								`${text.slice(0, caret)}${lead}@${text.slice(caret)}`,
								caret + lead.length + 1,
							);
							requestAnimationFrame(() => {
								el?.focus();
								el?.setSelectionRange(
									caret + lead.length + 1,
									caret + lead.length + 1,
								);
							});
						}}
					>
						<span
							className="icon-[solar--mention-circle-linear] size-4"
							aria-hidden="true"
						/>
					</button>
					<span className="sp" />
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
			<p className="faint ai-note">
				{own ? (
					<>Using your {providerOf(own.provider)?.label} key.</>
				) : (
					<>
						{free === null
							? ""
							: `${free} of ${ai?.aiStatus.limit} free messages left today. `}
						<Link
							to="/w/$slug/settings"
							params={{ slug }}
							search={{ sec: "ai" }}
						>
							Use your own AI key
						</Link>{" "}
						for more. Free models may log prompts.
					</>
				)}
			</p>
		</div>
	);
}

type ApprovalArgs = {
	taskIds?: string[];
	projectId?: string;
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
	const { data } = useQuery(TASKS, {
		variables: { slug },
		skip: tool === "archiveProject",
	});
	const project = useQuery(SHELL, {
		variables: { slug },
		fetchPolicy: "cache-only",
	}).data?.workspace?.projects.find((p) => p.id === args.projectId);
	const names = new Map(
		(data?.workspace?.tasks ?? []).map((t) => [t.id, `${t.key} ${t.name}`]),
	);
	const ids = args.taskIds ?? [];
	const lines =
		tool === "archiveProject"
			? ["It leaves the sidebar; you can bring it back from Archive."]
			: tool === "deleteTasks"
				? ["Delete these tasks (you can restore them later)"]
				: [
						args.status && `Status → ${taskStatus(args.status).name}`,
						args.priority &&
							`Priority → ${PRIORITIES.find((p) => p.id === args.priority)?.name ?? args.priority}`,
						args.dueDate !== undefined &&
							`Due date → ${args.dueDate ?? "none"}`,
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
				{tool === "archiveProject"
					? `Archive “${project?.title ?? "this project"}”?`
					: `${tool === "deleteTasks" ? "Delete" : "Change"} ${ids.length} ${ids.length === 1 ? "task" : "tasks"}?`}
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
