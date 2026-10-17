import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { type SavedView, TASKS, type TaskItem } from "#/graphql/operations";
import { applyView, groupTasks } from "#/lib/view-engine";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { TaskViewProvider, useTaskView } from "./context";
import { ListView } from "./list-view";
import { useNewTask } from "./new-task";
import { TaskViewSkeleton, ToolbarSkeleton } from "./skeletons";
import { ColumnsMenu, TableView } from "./table-view";
import {
	TimelineControls,
	TimelineView,
	useTimelineState,
} from "./timeline-view";
import { PROJECT_FIELDS, useViewState, ViewToolbar } from "./toolbar";

// A project's task tabs (reference project.js taskViewBody): toolbar plus one view.

export type TaskViewType = "list" | "board" | "table" | "calendar" | "timeline";

export function ProjectTasks({
	slug,
	projectId,
	type,
	milestones,
	color,
	savedView,
}: {
	slug: string;
	projectId: string;
	type: TaskViewType;
	/** shown on the timeline */
	milestones: { id: string; name: string; date: string }[];
	color: string;
	/** a saved view tab: its own filters, starting from the saved ones */
	savedView?: SavedView;
}) {
	const { data, loading } = useQuery(TASKS, {
		variables: { slug, projectId },
		fetchPolicy: "cache-and-network",
	});
	const workspace = data?.workspace;
	if (!workspace)
		return loading ? (
			<>
				<ToolbarSkeleton />
				<TaskViewSkeleton type={type} />
			</>
		) : null;
	return (
		<TaskViewProvider
			slug={slug}
			members={workspace.members}
			projects={workspace.projects}
		>
			<Body
				projectId={projectId}
				type={type}
				savedView={savedView}
				tasks={workspace.tasks}
				milestones={milestones.map((m) => ({ ...m, color }))}
			/>
		</TaskViewProvider>
	);
}

function Body({
	projectId,
	savedView,
	type,
	tasks,
	milestones,
}: {
	projectId: string;
	savedView?: SavedView;
	type: TaskViewType;
	tasks: TaskItem[];
	milestones: { id: string; name: string; date: string; color: string }[];
}) {
	const { members, projects, member, project, canEdit } = useTaskView();
	const [view, setView] = useViewState(
		savedView ? `sv:${savedView.id}` : `p:${projectId}`,
		{
			hidden: ["start", "created", "deps", "project"],
			...(savedView && { filters: savedView.filters }),
		},
	);
	const [tl, setTl] = useTimelineState(projectId, "status");
	const [todayTick, setTodayTick] = useState(0);
	const newTask = useNewTask();
	const shown = applyView(tasks, view, {
		assignee: (id) => member(id)?.name ?? "zzz",
		project: (id) => project(id)?.title ?? "",
	});
	const groups = groupTasks(shown, view.group, { members, projects });
	const editable = canEdit(projectId);
	const add = editable ? () => newTask({ projectId }) : undefined;
	const addBtn = add && (
		<button type="button" className="btn btn-primary btn-sm" onClick={add}>
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
	const toolbar = (opts: { group?: boolean; extra?: React.ReactNode }) => (
		<ViewToolbar
			view={view}
			setView={setView}
			fields={PROJECT_FIELDS}
			group={opts.group ?? true}
			extra={opts.extra}
			right={addBtn}
		/>
	);

	if (type === "board")
		return (
			<>
				{toolbar({ group: false })}
				{tasks.length ? (
					<BoardView
						tasks={shown}
						projectId={projectId}
						storageKey={projectId}
					/>
				) : (
					emptyAll
				)}
			</>
		);
	if (type === "table")
		return (
			<>
				{toolbar({
					extra: <ColumnsMenu view={view} setView={setView} hideProject />,
				})}
				{!tasks.length ? (
					emptyAll
				) : shown.length ? (
					<TableView
						groups={groups}
						view={view}
						setView={setView}
						projectId={projectId}
						onNew={add}
					/>
				) : (
					emptyFilter
				)}
			</>
		);
	if (type === "calendar")
		return (
			<>
				{toolbar({ group: false })}
				<CalendarView
					tasks={shown}
					projectId={projectId}
					storageKey={projectId}
				/>
			</>
		);
	if (type === "timeline")
		return (
			<>
				{toolbar({
					group: false,
					extra: (
						<TimelineControls
							state={tl}
							setState={setTl}
							onToday={() => setTodayTick((n) => n + 1)}
						/>
					),
				})}
				<TimelineView
					tasks={shown}
					milestones={milestones}
					zoom={tl.zoom}
					group={tl.group}
					project={projectId}
					todayTick={todayTick}
					onNew={add}
				/>
			</>
		);
	return (
		<>
			{toolbar({})}
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
		</>
	);
}
