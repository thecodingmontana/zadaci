import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { TASKS, type TaskItem } from "#/graphql/operations";
import { applyView, groupTasks } from "#/lib/view-engine";
import { TaskViewProvider, useTaskView } from "./context";
import { ListView } from "./list-view";
import { PROJECT_FIELDS, useViewState, ViewToolbar } from "./toolbar";

// A project's task tabs (reference project.js taskViewBody): toolbar plus one view.

export function ProjectTasks({
	slug,
	projectId,
}: {
	slug: string;
	projectId: string;
	/** which view; more join "list" as they are built */
	type: "list";
}) {
	const { data, loading } = useQuery(TASKS, {
		variables: { slug, projectId },
		fetchPolicy: "cache-and-network",
	});
	const workspace = data?.workspace;
	if (!workspace)
		return loading ? <div className="page faint">Loading tasks…</div> : null;
	return (
		<TaskViewProvider
			slug={slug}
			members={workspace.members}
			projects={workspace.projects}
		>
			<Body projectId={projectId} tasks={workspace.tasks} />
		</TaskViewProvider>
	);
}

function Body({ projectId, tasks }: { projectId: string; tasks: TaskItem[] }) {
	const { members, projects, member, project, canEdit, create } = useTaskView();
	const [view, setView] = useViewState(`p:${projectId}`);
	const [adding, setAdding] = useState(false);
	const shown = applyView(tasks, view, {
		assignee: (id) => member(id)?.name ?? "zzz",
		project: (id) => project(id)?.title ?? "",
	});
	const groups = groupTasks(shown, view.group, { members, projects });
	const editable = canEdit(projectId);
	const addBtn = editable && (
		<button
			type="button"
			className="btn btn-primary btn-sm"
			onClick={() => setAdding(true)}
		>
			<span
				className="icon-[hugeicons--plus-sign] size-[13px]"
				aria-hidden="true"
			/>
			New task
		</button>
	);
	const emptyAll = (
		<div className="empty-state">
			<div className="glyph">
				<span
					className="icon-[solar--checklist-minimalistic-linear] size-5"
					aria-hidden="true"
				/>
			</div>
			<h2 className="es-h">No tasks here</h2>
			<p>Add a task to get things moving.</p>
			{addBtn}
		</div>
	);
	const emptyFilter = (
		<div className="empty-state">
			<div className="glyph">
				<span
					className="icon-[solar--magnifer-bug-linear] size-5"
					aria-hidden="true"
				/>
			</div>
			<h2 className="es-h">No results found</h2>
			<p>No tasks match these filters.</p>
			<button
				type="button"
				className="btn btn-secondary btn-sm"
				onClick={() => setView({ filters: [], q: "" })}
			>
				Clear filters
			</button>
		</div>
	);

	return (
		<>
			<ViewToolbar
				view={view}
				setView={setView}
				fields={PROJECT_FIELDS}
				right={addBtn}
			/>
			<div className="list-wrap">
				{!tasks.length ? (
					emptyAll
				) : !shown.length ? (
					emptyFilter
				) : (
					<ListView
						groups={groups}
						view={view}
						setView={setView}
						projectId={projectId}
					/>
				)}
			</div>
			{adding && (
				<QuickAdd
					onClose={() => setAdding(false)}
					onAdd={(title) => create({ projectId, title, status: "todo" })}
				/>
			)}
		</>
	);
}

// shortcut: a one-line "New task" until the task modal (step 2d) replaces it
function QuickAdd({
	onClose,
	onAdd,
}: {
	onClose: () => void;
	onAdd: (title: string) => Promise<unknown>;
}) {
	const [title, setTitle] = useState("");
	return (
		<div
			className="addrow"
			style={{ background: "var(--q-surface-2)", margin: "0 var(--q-gutter)" }}
		>
			<span
				className="icon-[hugeicons--plus-sign] size-3.5"
				aria-hidden="true"
			/>
			<input
				className="inline-in"
				placeholder="Task name — press Enter to add, Esc to cancel"
				aria-label="New task name"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={async (e) => {
					if (e.key === "Escape") onClose();
					if (e.key === "Enter" && title.trim()) {
						await onAdd(title.trim());
						setTitle("");
					}
				}}
				onBlur={() => !title.trim() && onClose()}
				// biome-ignore lint/a11y/noAutofocus: opened by the New task button to type a name
				autoFocus
			/>
		</div>
	);
}
