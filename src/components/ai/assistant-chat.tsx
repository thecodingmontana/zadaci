import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useModKey } from "#/components/shell/command-menu";
import { cn } from "#/lib/utils";

// The assistant's chat: your messages, its streamed answers, and what it did with tools.

export const MAX_MESSAGE = 2000;

const SUGGESTIONS = [
	"What's due this week?",
	"Plan my week",
	"Add a task to send the invoice on Friday",
];

export function AssistantChat({ slug }: { slug: string }) {
	const mod = useModKey();
	const [text, setText] = useState("");
	const list = useRef<HTMLDivElement>(null);
	const { messages, sendMessage, isLoading, error, stop, reload } = useChat({
		connection: fetchServerSentEvents("/api/chat"),
		forwardedProps: { slug },
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
								return (
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
										{part.name}
									</div>
								);
							return null;
						})}
					</div>
				))}
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
