import { useApolloClient, useQuery } from "@apollo/client/react";
import {
	createContext,
	type FormEvent,
	type ReactNode,
	useContext,
	useState,
} from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { Modal } from "#/components/q/modal";
import { useModKey } from "#/components/shell/command-menu";
import { SHELL, TASKS, type TaskItem } from "#/graphql/operations";
import { FILE_TYPES, fileKind, fmtSize } from "#/lib/files";
import { hasRight } from "#/lib/permissions";
import { inlineMarks, LABELS, RECURS } from "#/lib/tasks";
import { fmtDay } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Lbl, PrPill, StPill } from "./bits";
import { TASK_REFETCH, TaskViewProvider, useTaskView } from "./context";
import {
	AssigneePick,
	DatePick,
	MultiPick,
	PickList,
	PickPopover,
	PriorityPick,
	ProjectPick,
	StatusPick,
} from "./pick";
import { uploadFile } from "./upload";

// The "New task" modal (reference taskModal + newTask/submitTask), opened from anywhere in
// the workspace with useNewTask()(prefill).

type Prefill = Partial<{
	projectId: string;
	status: string;
	assigneeId: string | null;
	dueDate: string;
	priority: string;
}>;

const NewTaskContext = createContext<((prefill?: Prefill) => void) | null>(
	null,
);

const CanCreateContext = createContext(false);

/** Whether the viewer can add a task anywhere: some open project they can edit. */
export const useCanCreateTask = () => useContext(CanCreateContext);

export function useNewTask() {
	const open = useContext(NewTaskContext);
	if (!open) throw new Error("useNewTask must be used inside NewTaskProvider");
	return open;
}

export function NewTaskProvider({
	slug,
	children,
}: {
	slug: string;
	children: ReactNode;
	/** opens the new task (the drawer) when the toast's Open is pressed */
}) {
	const [prefill, setPrefill] = useState<Prefill | null>(null);
	const { data: shell } = useQuery(SHELL, { variables: { slug } });
	const canCreate = !!shell?.workspace?.projects.some(
		(p) => p.status !== "complete" && hasRight(p.myAccess, "edit"),
	);
	return (
		<NewTaskContext.Provider value={(p = {}) => setPrefill(p)}>
			<CanCreateContext.Provider value={canCreate}>
				{children}
			</CanCreateContext.Provider>
			{prefill && (
				<NewTaskLoader
					slug={slug}
					prefill={prefill}
					onClose={() => setPrefill(null)}
				/>
			)}
		</NewTaskContext.Provider>
	);
}

function NewTaskLoader({
	slug,
	prefill,
	onClose,
}: {
	slug: string;
	prefill: Prefill;
	onClose: () => void;
}) {
	// people and projects; the tasks themselves aren't needed here
	const { data } = useQuery(TASKS, {
		variables: { slug, projectId: "__none__" },
	});
	const workspace = data?.workspace;
	if (!workspace) return null;
	return (
		<TaskViewProvider
			slug={slug}
			members={workspace.members}
			projects={workspace.projects}
		>
			<TaskModal prefill={prefill} onClose={onClose} />
		</TaskViewProvider>
	);
}

function TaskModal({
	prefill,
	onClose,
}: {
	prefill: Prefill;
	onClose: () => void;
}) {
	const { slug, members, projects, meId, create, member, project } =
		useTaskView();
	const client = useApolloClient();
	const mod = useModKey();
	const writable = projects.filter(
		(p) => p.status !== "complete" && hasRight(p.myAccess, "edit"),
	);
	const initial = () => ({
		title: "",
		description: "",
		projectId:
			prefill.projectId && writable.some((p) => p.id === prefill.projectId)
				? prefill.projectId
				: (writable[0]?.id ?? ""),
		status: prefill.status ?? "todo",
		assigneeId: prefill.assigneeId === undefined ? meId : prefill.assigneeId,
		priority: prefill.priority ?? "medium",
		dueDate: prefill.dueDate ?? null,
		startDate: null as string | null,
		labels: [] as string[],
		recur: null as string | null,
		subtasks: [] as string[],
		files: [] as File[],
	});
	const [form, setForm] = useState(initial);
	const [more, setMore] = useState(false);
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);
	const [sub, setSub] = useState("");
	const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
		setForm((f) => ({ ...f, [k]: v }));
	const p = project(form.projectId);
	const m = member(form.assigneeId);

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const title = form.title.trim();
		if (!title) return setErr("Give the task a name");
		if (!form.projectId)
			return setErr("You can't add tasks to any project yet");
		setBusy(true);
		try {
			const start =
				form.startDate && form.dueDate && form.startDate > form.dueDate
					? form.dueDate
					: form.startDate;
			const task: TaskItem | undefined = await create({
				projectId: form.projectId,
				title,
				description: form.description.trim()
					? toHtml(form.description.trim())
					: null,
				status: form.status,
				assigneeId: form.assigneeId,
				priority: form.priority,
				dueDate: form.dueDate,
				startDate: start,
				labels: form.labels,
				recur: form.recur,
			});
			if (!task) return;
			for (const name of form.subtasks)
				await create({
					projectId: form.projectId,
					parentId: task.id,
					title: name,
					status: "todo",
				});
			for (const file of form.files) {
				try {
					await uploadFile(client, slug, { taskId: task.id }, file);
				} catch (error) {
					toast.error(`Couldn't upload ${file.name}`, {
						desc: (error as Error).message,
					});
				}
			}
			if (form.subtasks.length || form.files.length)
				await client.refetchQueries({ include: TASK_REFETCH });
			if (more)
				setForm({
					...initial(),
					projectId: form.projectId,
					status: form.status,
				});
			else onClose();
		} finally {
			setBusy(false);
		}
	}

	const chip = (label: string, body: ReactNode, empty?: boolean) => (
		<button
			type="button"
			className={cn("pillbtn bordered", empty && "empty")}
			aria-label={label}
		>
			{body}
		</button>
	);

	return (
		<Modal
			busy={busy}
			open
			onOpenChange={(o) => !o && onClose()}
			title="New task"
			footer={
				<>
					<label
						className="row"
						style={{
							gap: 8,
							fontSize: 12.5,
							color: "var(--q-text-2)",
							cursor: "pointer",
						}}
					>
						<input
							type="checkbox"
							className="toggle"
							checked={more}
							onChange={(e) => setMore(e.target.checked)}
						/>
						Create more
					</label>
					<span className="sp" />
					<span className="faint hide-m" style={{ fontSize: 11.5 }}>
						<kbd>{mod}</kbd> <kbd>↵</kbd>
					</span>
					<button type="button" className="btn btn-secondary" onClick={onClose}>
						Cancel
					</button>
					<button
						type="submit"
						form="task-form"
						className={cn("btn btn-primary", busy && "is-loading")}
						disabled={busy}
					>
						Create task
					</button>
				</>
			}
		>
			<form
				id="task-form"
				className="modal-b"
				style={{ gap: 12 }}
				onSubmit={submit}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
				}}
			>
				<div className="field">
					<label className="sr" htmlFor="f-title">
						Task name
					</label>
					<input
						className={cn("input input-lg", err && "is-error")}
						id="f-title"
						placeholder="Task name"
						value={form.title}
						onChange={(e) => {
							set("title", e.target.value);
							if (err) setErr("");
						}}
						style={{ fontSize: 15, fontWeight: 500 }}
						aria-invalid={!!err}
						aria-describedby={err ? "f-title-err" : undefined}
						maxLength={500}
						// biome-ignore lint/a11y/noAutofocus: the modal opens to type a task name
						autoFocus
					/>
					{err && (
						<span className="err" id="f-title-err" role="alert">
							<span
								className="icon-[solar--danger-circle-linear] size-3"
								aria-hidden="true"
							/>
							{err}
						</span>
					)}
				</div>
				<div className="field">
					<label className="sr" htmlFor="f-desc">
						Description
					</label>
					<textarea
						className="textarea"
						id="f-desc"
						placeholder="Add a description… (optional)"
						rows={3}
						value={form.description}
						onChange={(e) => set("description", e.target.value)}
					/>
				</div>
				<div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
					<ProjectPick
						value={form.projectId}
						projects={writable}
						onPick={(id) => set("projectId", id)}
					>
						{chip(
							"Project",
							<>
								<span
									className="pdot"
									style={
										{ "--c": projectColor(p?.color) } as React.CSSProperties
									}
								/>
								{p?.title ?? "Project"}
							</>,
						)}
					</ProjectPick>
					<StatusPick value={form.status} onPick={(s) => set("status", s)}>
						{chip("Status", <StPill status={form.status} />)}
					</StatusPick>
					<AssigneePick
						value={form.assigneeId}
						people={members}
						onPick={(id) => set("assigneeId", id)}
					>
						{chip(
							"Assignee",
							<>
								{m ? (
									<Av name={m.name} image={m.image} className="sm" />
								) : (
									<span
										className="av sm"
										style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
									/>
								)}
								{m?.name ?? "Assignee"}
							</>,
							!m,
						)}
					</AssigneePick>
					<PriorityPick
						value={form.priority}
						onPick={(v) => set("priority", v)}
					>
						{chip("Priority", <PrPill p={form.priority} />)}
					</PriorityPick>
					<DatePick value={form.dueDate} onPick={(d) => set("dueDate", d)}>
						{chip(
							"Due date",
							<>
								<span
									className="icon-[solar--calendar-linear] size-[13px]"
									aria-hidden="true"
								/>
								{form.dueDate ? `Due ${fmtDay(form.dueDate)}` : "Due date"}
							</>,
							!form.dueDate,
						)}
					</DatePick>
					<DatePick value={form.startDate} onPick={(d) => set("startDate", d)}>
						{chip(
							"Start date",
							<>
								<span
									className="icon-[solar--calendar-add-linear] size-[13px]"
									aria-hidden="true"
								/>
								{form.startDate
									? `Starts ${fmtDay(form.startDate)}`
									: "Start date"}
							</>,
							!form.startDate,
						)}
					</DatePick>
					<MultiPick
						search="Filter labels…"
						onToggle={(id) =>
							set(
								"labels",
								form.labels.includes(id)
									? form.labels.filter((l) => l !== id)
									: [...form.labels, id],
							)
						}
						items={LABELS.map((l) => ({
							id: l.id,
							name: l.name,
							icon: (
								<span
									className="pdot"
									style={{ "--c": l.c } as React.CSSProperties}
								/>
							),
							on: form.labels.includes(l.id),
						}))}
					>
						{chip(
							"Labels",
							form.labels.length ? (
								form.labels.map((id) => <Lbl key={id} id={id} />)
							) : (
								<>
									<span
										className="icon-[solar--tag-linear] size-[13px]"
										aria-hidden="true"
									/>
									Labels
								</>
							),
							!form.labels.length,
						)}
					</MultiPick>
					<PickPopover
						width={200}
						trigger={chip(
							"Repeat",
							<>
								<span
									className="icon-[solar--repeat-linear] size-[13px]"
									aria-hidden="true"
								/>
								{form.recur ?? "Repeat"}
							</>,
							!form.recur,
						)}
					>
						<PickList
							items={[
								{ id: "", name: "Does not repeat", on: !form.recur },
								...RECURS.map((r) => ({
									id: r,
									name: r,
									on: form.recur === r,
								})),
							]}
							onPick={(id) => set("recur", id || null)}
						/>
					</PickPopover>
				</div>
				<div className="field">
					<span className="label">Subtasks</span>
					{form.subtasks.map((s, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: draft rows in order
						<div key={i} className="subt" style={{ padding: "0 4px" }}>
							<span
								className="icon-[solar--record-circle-linear] size-[13px]"
								aria-hidden="true"
							/>
							<span className="s">{s}</span>
							<button
								type="button"
								className="ibtn ibtn-xs x"
								style={{ opacity: 1 }}
								aria-label="Remove"
								onClick={() =>
									set(
										"subtasks",
										form.subtasks.filter((_, j) => j !== i),
									)
								}
							>
								<span
									className="icon-[solar--close-circle-linear] size-3"
									aria-hidden="true"
								/>
							</button>
						</div>
					))}
					<div className="inwrap">
						<span
							className="i icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
						<input
							className="input"
							placeholder="Add a subtask and press Enter"
							aria-label="Add a subtask"
							value={sub}
							onChange={(e) => setSub(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
									e.preventDefault();
									if (sub.trim()) {
										set("subtasks", [...form.subtasks, sub.trim()]);
										setSub("");
									}
								}
							}}
						/>
					</div>
				</div>
				<div className="field">
					<span className="label">Attachments</span>
					{form.files.length > 0 && (
						<div className="col" style={{ gap: 4 }}>
							{form.files.map((f, i) => {
								const k = FILE_TYPES[fileKind(f.name)];
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: draft files in order
									<div key={i} className="upl" style={{ padding: "6px 10px" }}>
										<span
											className="ftype"
											style={
												{
													"--c": k.c,
													width: 22,
													height: 22,
												} as React.CSSProperties
											}
										>
											<span
												className={cn(k.icon, "size-3")}
												aria-hidden="true"
											/>
										</span>
										<span className="grow trunc">{f.name}</span>
										<span className="faint" style={{ fontSize: 11.5 }}>
											{fmtSize(f.size)}
										</span>
										<button
											type="button"
											className="ibtn ibtn-xs"
											aria-label="Remove"
											onClick={() =>
												set(
													"files",
													form.files.filter((_, j) => j !== i),
												)
											}
										>
											<span
												className="icon-[solar--close-circle-linear] size-3"
												aria-hidden="true"
											/>
										</button>
									</div>
								);
							})}
						</div>
					)}
					<label
						className="dropzone"
						style={{ padding: 10, cursor: "pointer" }}
					>
						<span
							className="icon-[solar--paperclip-linear] size-3.5"
							aria-hidden="true"
						/>
						<span>Attach files</span>
						<input
							type="file"
							multiple
							hidden
							onChange={(e) =>
								e.target.files &&
								set("files", [...form.files, ...e.target.files])
							}
						/>
					</label>
				</div>
			</form>
		</Modal>
	);
}

const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain description text as the drawer's simple HTML: one paragraph per blank-line block. */
function toHtml(text: string) {
	return text
		.split(/\n{2,}/)
		.map(
			(block) =>
				`<p>${inlineMarks(escapeHtml(block)).replace(/\n/g, "<br>")}</p>`,
		)
		.join("");
}
