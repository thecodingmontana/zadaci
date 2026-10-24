import { useQuery } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { StatusIcon } from "#/components/q/status-icon";
import { SEARCH, SHELL } from "#/graphql/operations";
import { TASK_STATUSES } from "#/lib/tasks";
import { cn } from "#/lib/utils";

// How the assistant's work shows in the chat: a "Thinking" card with each step and what it found
// (like the reference recording), the tasks, projects and notes it touched as a list you can
// open, and @mentions in messages.

export type Item = {
	kind: "task" | "project" | "note";
	id: string;
	label: string;
	/** a task's status id, for its icon */
	status?: string;
	/** a task's project, or a project's colour */
	sub?: string;
};

type ToolCall = { name: string; input?: unknown; output?: unknown };

const parse = (v: unknown) => {
	if (typeof v !== "string") return v;
	try {
		return JSON.parse(v);
	} catch {
		return null;
	}
};

const statusId = (name: unknown) =>
	TASK_STATUSES.find((s) => s.name === name || s.id === name)?.id ?? "todo";

type Row = Record<string, unknown>;
const task = (t: Row): Item => ({
	kind: "task",
	id: String(t.id),
	label: [t.key, t.title ?? t.name].filter(Boolean).join(" "),
	status: statusId(t.status),
	sub: typeof t.project === "string" ? t.project : undefined,
});

/** The items a tool call found or changed, from its result. */
export function itemsOf(call: ToolCall): Item[] {
	const out = parse(call.output) as Row | null;
	const input = parse(call.input) as Row | null;
	if (!out || typeof out !== "object" || "error" in out) return [];
	const rows = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);
	const items: Item[] = [
		...rows(out.tasks).map(task),
		...rows(out.changed)
			.filter((c) => c.id)
			.map(task),
		...rows(out.projects).map((p) => ({
			kind: "project" as const,
			id: String(p.id),
			label: String(p.title),
		})),
		...rows(out.notes).map((n) => ({
			kind: "note" as const,
			id: String(n.id),
			label: String(n.title || "Untitled"),
		})),
	];
	const created = out.created as Row | undefined;
	if (created?.id)
		items.push(
			call.name === "createNote"
				? { kind: "note", id: String(created.id), label: String(created.title) }
				: task(created),
		);
	if (call.name === "getItem" && out.id && input?.kind !== "bookmark")
		items.push(
			input?.kind === "note"
				? { kind: "note", id: String(out.id), label: String(out.title) }
				: task(out),
		);
	return items;
}

/** What a step reads as, while it runs and once it's done. */
const STEP: Record<string, [string, string]> = {
	searchItems: ["Searching the workspace", "Searched the workspace"],
	listTasks: ["Looking at tasks", "Looked at tasks"],
	listProjects: ["Looking at projects", "Looked at projects"],
	getItem: ["Opening an item", "Opened an item"],
	createTask: ["Creating a task", "Created a task"],
	updateTask: ["Updating tasks", "Updated tasks"],
	addTag: ["Adding a tag", "Added a tag"],
	bulkUpdateTasks: ["Updating tasks", "Updated tasks"],
	moveTask: ["Moving a task", "Moved a task"],
	addComment: ["Adding a comment", "Added a comment"],
	createNote: ["Writing a note", "Wrote a note"],
	deleteTasks: ["Deleting tasks", "Deleted tasks"],
	listMembers: ["Looking at people", "Looked at people"],
	assignTasks: ["Assigning tasks", "Assigned tasks"],
	addSubtask: ["Adding a subtask", "Added a subtask"],
	restoreTasks: ["Restoring tasks", "Restored tasks"],
	duplicateTask: ["Copying a task", "Copied a task"],
	timer: ["Updating the timer", "Updated the timer"],
	createProject: ["Creating a project", "Created a project"],
	updateProject: ["Updating a project", "Updated a project"],
	archiveProject: ["Archiving a project", "Archived a project"],
	addMilestone: ["Adding a milestone", "Added a milestone"],
	editNote: ["Editing a note", "Edited a note"],
	commentOnNote: ["Commenting on a note", "Commented on a note"],
	saveBookmark: ["Saving a bookmark", "Saved a bookmark"],
};

function stepLabel(call: ToolCall, done: boolean) {
	const [doing, did] = STEP[call.name] ?? [call.name, call.name];
	const q = (parse(call.input) as Row | null)?.query;
	return call.name === "searchItems" && typeof q === "string"
		? `${done ? "Searched" : "Searching"} for “${q}”`
		: done
			? did
			: doing;
}

/** Opens an item: a task in the drawer, a project or note on its page. */
export function useOpenItem(slug: string) {
	const router = useRouter();
	return (item: Item) =>
		item.kind === "task"
			? router.navigate({
					to: ".",
					search: ((prev: Record<string, unknown>) => ({
						...prev,
						task: item.id,
					})) as never,
				})
			: item.kind === "project"
				? router.navigate({
						to: "/w/$slug/p/$projectId",
						params: { slug, projectId: item.id },
					})
				: router.navigate({
						to: "/w/$slug/notes/$noteId",
						params: { slug, noteId: item.id },
					});
}

function ItemIcon({ item }: { item: Item }) {
	if (item.kind === "task")
		return <StatusIcon status={item.status ?? "todo"} size={12} />;
	if (item.kind === "project")
		return (
			<span
				className="ai-pdot"
				style={{ background: projectColor(item.sub) }}
				aria-hidden="true"
			/>
		);
	return (
		<span
			className="icon-[solar--document-text-linear] size-3"
			aria-hidden="true"
		/>
	);
}

const CHIPS = 4;

/**
 * The work behind an answer: each step in order, the current one shimmering while it runs,
 * then "Worked for 7s" and "Finished thinking".
 */
export function ThinkingCard({
	calls,
	live,
	startedAt,
	seconds,
	onOpen,
}: {
	calls: ToolCall[];
	live: boolean;
	startedAt?: number;
	seconds?: number;
	onOpen: (item: Item) => void;
}) {
	const [open, setOpen] = useState(true);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!live) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [live]);
	const elapsed = live
		? Math.max(1, Math.round((now - (startedAt ?? now)) / 1000))
		: seconds;
	return (
		<div className={cn("ai-think", live && "live")}>
			<button
				type="button"
				className="ai-think-h"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				<span
					className="icon-[solar--widget-2-linear] size-3.5"
					aria-hidden="true"
				/>
				<b>
					{live ? "Thinking" : elapsed ? `Worked for ${elapsed}s` : "Worked"}
				</b>
				{live && <span className="faint num">{elapsed}s</span>}
				<span className="sp" />
				<span
					className={cn(
						"icon-[solar--alt-arrow-down-linear] size-3.5 faint",
						!open && "-rotate-90",
					)}
					aria-hidden="true"
				/>
			</button>
			{open && (
				<ol className="ai-steps">
					{calls.map((call, i) => {
						const running = live && i === calls.length - 1 && !call.output;
						const items = itemsOf(call);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: steps only ever append
							<li key={i} className={cn(running && "now")}>
								<span className={cn("shim", running && "on")}>
									{stepLabel(call, !running)}
								</span>
								{items.length > 0 && (
									<div className="ai-chips">
										{items.slice(0, CHIPS).map((item) => (
											<button
												key={`${item.kind}-${item.id}`}
												type="button"
												className="ai-chip"
												onClick={() => onOpen(item)}
											>
												<ItemIcon item={item} />
												<span className="trunc">{item.label}</span>
											</button>
										))}
										{items.length > CHIPS && (
											<span className="faint ai-more">
												+{items.length - CHIPS} more
											</span>
										)}
									</div>
								)}
							</li>
						);
					})}
					{!live && (
						<li className="done">
							<span
								className="icon-[solar--check-circle-bold] size-3.5"
								aria-hidden="true"
							/>
							Finished thinking
						</li>
					)}
				</ol>
			)}
		</div>
	);
}

/** The tasks, projects and notes an answer is about, as rows you can open. */
export function ItemList({
	items,
	onOpen,
}: {
	items: Item[];
	onOpen: (item: Item) => void;
}) {
	const seen = new Set<string>();
	const unique = items.filter((i) => {
		const k = `${i.kind}-${i.id}`;
		return seen.has(k) ? false : (seen.add(k), true);
	});
	if (!unique.length) return null;
	return (
		<ul className="ai-items">
			{unique.slice(0, 8).map((item) => (
				<li key={`${item.kind}-${item.id}`}>
					<button type="button" onClick={() => onOpen(item)}>
						<ItemIcon item={item} />
						<span className="trunc">{item.label}</span>
						{item.kind === "task" && item.sub && (
							<span className="faint trunc ai-sub">{item.sub}</span>
						)}
						<span
							className="icon-[solar--alt-arrow-right-linear] size-3 faint"
							aria-hidden="true"
						/>
					</button>
				</li>
			))}
			{unique.length > 8 && (
				<li className="faint ai-more">and {unique.length - 8} more</li>
			)}
		</ul>
	);
}

// @[ALP-1 Wireframes](task:abc123): how a mention is written into a message
const MENTION =
	/@\[([^\]]{1,120})\]\((task|project|note):([A-Za-z0-9_-]{1,32})\)/g;

export const mentionToken = (item: Item) =>
	`@[${item.label.replace(/[[\]]/g, "")}](${item.kind}:${item.id})`;

/** One line of text with **bold** and `code`. */
function inline(text: string, key: string) {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((bit, i) =>
		bit.startsWith("**") && bit.endsWith("**") ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: pieces of one line
			<b key={`${key}-${i}`}>{bit.slice(2, -2)}</b>
		) : bit.startsWith("`") && bit.endsWith("`") ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: pieces of one line
			<code key={`${key}-${i}`}>{bit.slice(1, -1)}</code>
		) : (
			bit
		),
	);
}

/** A message's text: @mentions as chips you can open, light markdown, bullet lists. */
export function MessageText({
	text,
	onOpen,
}: {
	text: string;
	onOpen: (item: Item) => void;
}) {
	const out: ReactNode[] = [];
	let last = 0;
	for (const m of text.matchAll(MENTION)) {
		out.push(...lines(text.slice(last, m.index), `t${last}`));
		const item = { kind: m[2], id: m[3], label: m[1] } as Item;
		out.push(
			<button
				key={`m${m.index}`}
				type="button"
				className="ai-chip inline"
				onClick={() => onOpen(item)}
			>
				<ItemIcon item={item} />
				{m[1]}
			</button>,
		);
		last = (m.index ?? 0) + m[0].length;
	}
	out.push(...lines(text.slice(last), `t${last}`));
	return <div className="ai-text">{out}</div>;
}

function lines(text: string, key: string) {
	return text.split("\n").map((line, i) => {
		const k = `${key}-${i}`;
		const bullet = /^\s*[-*•] (.*)$/.exec(line);
		return (
			<Fragment key={k}>
				{i > 0 && !bullet && "\n"}
				{bullet ? (
					<span className="ai-li">{inline(bullet[1], k)}</span>
				) : (
					inline(line, k)
				)}
			</Fragment>
		);
	});
}

/** Finds a task, project or note to mention, from the workspace search. */
export function MentionPicker({
	slug,
	q,
	onPick,
}: {
	slug: string;
	q: string;
	onPick: (item: Item) => void;
}) {
	const [debounced, setDebounced] = useState(q);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(q.trim()), 150);
		return () => clearTimeout(id);
	}, [q]);
	// like the ⌘K search: earlier results stay up while the next ones load
	const { data, previousData } = useQuery(SEARCH, {
		variables: { slug, q: debounced },
		skip: !debounced,
	});
	// projects are already loaded for the sidebar, so they match at once, before the server answers
	const shell = useQuery(SHELL, {
		variables: { slug },
		fetchPolicy: "cache-only",
	}).data?.workspace?.projects;
	const ql = q.trim().toLowerCase();
	const local = (shell ?? [])
		.filter((p) => !ql || p.title.toLowerCase().includes(ql))
		.slice(0, 4);
	const s = debounced ? (data ?? previousData)?.search : undefined;
	const loading = !!ql && !s;
	const projects = [
		...local,
		...(s?.projects ?? []).filter((p) => !local.some((l) => l.id === p.id)),
	].slice(0, 4);
	const items: Item[] = [
		...projects.map((p) => ({
			kind: "project" as const,
			id: p.id,
			label: p.title,
			sub: p.color ?? undefined,
		})),
		...(s?.tasks ?? []).slice(0, 6).map((t) => ({
			kind: "task" as const,
			id: t.id,
			label: t.name,
			status: t.status,
			sub: t.projectTitle,
		})),
		...(s?.notes ?? []).slice(0, 4).map((n) => ({
			kind: "note" as const,
			id: n.id,
			label: n.title || "Untitled",
		})),
	];
	return (
		<div className="ai-mention pop" role="listbox" aria-label="Mention">
			<div className="ai-mention-h faint">
				{items.length
					? "Mention a project, task or note"
					: loading
						? "Searching…"
						: ql
							? "Nothing matches"
							: "Type to find a project, task or note"}
			</div>
			{items.map((item, i) => (
				<button
					key={`${item.kind}-${item.id}`}
					type="button"
					role="option"
					aria-selected={i === 0}
					className={cn("ai-mention-i", i === 0 && "hl")}
					// keeps focus in the textarea, so typing continues after a pick
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => onPick(item)}
				>
					<ItemIcon item={item} />
					<span className="trunc">{item.label}</span>
					{item.kind === "task" && item.sub && (
						<span className="faint trunc ai-sub">{item.sub}</span>
					)}
				</button>
			))}
		</div>
	);
}
