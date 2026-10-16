import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { type ReactNode, useEffect, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { TASKS, type TaskItem } from "#/graphql/operations";
import { isClosed } from "#/lib/tasks";
import {
	applyView,
	type Group,
	groupTasks,
	isOverdue,
} from "#/lib/view-engine";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { TaskViewProvider, useTaskView } from "./context";
import { ListView } from "./list-view";
import { useNewTask } from "./new-task";
import { ColumnsMenu, TableView } from "./table-view";
import {
	TimelineControls,
	TimelineView,
	useTimelineState,
} from "./timeline-view";
import { ALL_FIELDS, useViewState, ViewToolbar } from "./toolbar";

// Workspace-wide task pages (reference pages tasks.js, my-tasks.js, and the workspace
// Calendar and Timeline): the same views as a project, across every project you can see.

export type WorkspaceTasksKind = "tasks" | "my" | "calendar" | "timeline";

const MILESTONES: TypedDocumentNode<
	{
		workspace: {
			id: string;
			projects: {
				id: string;
				title: string;
				color: string | null;
				milestones: { id: string; name: string; date: string }[];
			}[];
		} | null;
	},
	{ slug: string }
> = gql`
	query WorkspaceMilestones($slug: String!) {
		workspace(slug: $slug) {
			id
			projects {
				id
				title
				color
				milestones {
					id
					name
					date
				}
			}
		}
	}
`;

export function WorkspaceTasks({
	slug,
	kind,
}: {
	slug: string;
	kind: WorkspaceTasksKind;
}) {
	const { data, loading } = useQuery(TASKS, {
		variables: { slug },
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
			{kind === "my" ? (
				<MyTasks tasks={workspace.tasks} />
			) : kind === "calendar" ? (
				<WsCalendar tasks={workspace.tasks} />
			) : kind === "timeline" ? (
				<WsTimeline slug={slug} tasks={workspace.tasks} />
			) : (
				<AllTasks tasks={workspace.tasks} />
			)}
		</TaskViewProvider>
	);
}

function useNames() {
	const { member, project } = useTaskView();
	return {
		assignee: (id: string | null) => member(id)?.name ?? "zzz",
		project: (id: string) => project(id)?.title ?? "",
	};
}

function Header({
	title,
	sub,
	acts,
}: {
	title: string;
	sub: ReactNode;
	acts?: ReactNode;
}) {
	return (
		<div className="ph">
			<div>
				<h1>{title}</h1>
				<p>{sub}</p>
			</div>
			{acts && <div className="acts">{acts}</div>}
		</div>
	);
}

function NewTaskButton({
	prefill,
}: {
	prefill?: Parameters<ReturnType<typeof useNewTask>>[0];
}) {
	const newTask = useNewTask();
	return (
		<button
			type="button"
			className="btn btn-primary"
			onClick={() => newTask(prefill)}
		>
			<span
				className="icon-[hugeicons--plus-sign] size-3.5"
				aria-hidden="true"
			/>
			New task
		</button>
	);
}

/** Remembered per browser: which layout a page shows. */
function useMode<T extends string>(key: string, fallback: T) {
	const storage = `zadaci:mode:${key}`;
	const [mode, setMode] = useState<T>(fallback);
	useEffect(() => {
		try {
			const saved = localStorage.getItem(storage);
			if (saved) setMode(saved as T);
		} catch {}
	}, [storage]);
	return [
		mode,
		(m: T) => {
			setMode(m);
			try {
				localStorage.setItem(storage, m);
			} catch {}
		},
	] as const;
}

function AllTasks({ tasks }: { tasks: TaskItem[] }) {
	const { members, projects } = useTaskView();
	const names = useNames();
	const [view, setView] = useViewState("tasks");
	const [mode, setMode] = useMode<"list" | "board" | "table">("tasks", "list");
	const newTask = useNewTask();
	const shown = applyView(tasks, view, names);
	const groups = groupTasks(shown, view.group, { members, projects });
	const right = (
		<div className="seg">
			{(
				[
					["list", "List", "icon-[solar--list-linear]"],
					["board", "Board", "icon-[hugeicons--kanban]"],
					["table", "Table", "icon-[solar--table-linear]"],
				] as const
			).map(([k, n, icon]) => (
				<button
					key={k}
					type="button"
					className={mode === k ? "on" : ""}
					onClick={() => setMode(k)}
				>
					<span className={`${icon} size-[13px]`} aria-hidden="true" />
					<span className="hide-m">{n}</span>
				</button>
			))}
		</div>
	);
	return (
		<div className="page flush">
			<Header
				title="Tasks"
				sub={`Every task across ${projects.length} project${projects.length === 1 ? "" : "s"}.`}
				acts={<NewTaskButton />}
			/>
			<ViewToolbar
				view={view}
				setView={setView}
				fields={ALL_FIELDS}
				group={mode !== "board"}
				extra={
					mode === "table" ? (
						<ColumnsMenu view={view} setView={setView} />
					) : undefined
				}
				right={right}
			/>
			{mode === "board" ? (
				<BoardView tasks={shown} showProject storageKey="tasks" />
			) : mode === "table" ? (
				<TableView
					groups={groups}
					view={view}
					setView={setView}
					onNew={() => newTask()}
				/>
			) : (
				<div className="list-wrap">
					<ListView
						groups={groups}
						view={view}
						setView={setView}
						cols={["status", "assignee", "priority", "due", "project"]}
					/>
				</div>
			)}
		</div>
	);
}

function MyTasks({ tasks }: { tasks: TaskItem[] }) {
	const { meId } = useTaskView();
	const names = useNames();
	const [view, setView] = useViewState("mytasks", { group: "none" });
	const [mode, setMode] = useMode<"list" | "calendar">("my", "list");
	const today = new Date();
	const days = (t: TaskItem) =>
		t.dueDate ? differenceInCalendarDays(parseISO(t.dueDate), today) : null;
	// "manual" order means nothing across projects; mine sort by due date unless chosen
	const mine = applyView(
		tasks.filter((t) => t.assigneeId === meId),
		view.sort.f === "manual" ? { ...view, sort: { f: "due", dir: 1 } } : view,
		names,
	);
	const iso = (n: number) =>
		format(new Date(today.getTime() + n * 86_400_000), "yyyy-MM-dd");
	const groups: Group<TaskItem>[] = [
		{
			key: "overdue",
			name: "Overdue",
			tasks: mine.filter((t) => isOverdue(t)),
			set: {},
		},
		{
			key: "today",
			name: "Today",
			tasks: mine.filter((t) => !isClosed(t.status) && days(t) === 0),
			set: { dueDate: iso(0) },
		},
		{
			key: "upcoming",
			name: "Upcoming",
			tasks: mine.filter(
				(t) =>
					!isClosed(t.status) && (days(t) === null || (days(t) as number) > 0),
			),
			set: { dueDate: iso(3) },
		},
		{
			key: "completed",
			name: "Completed",
			tasks: mine.filter((t) => t.status === "completed"),
			set: { status: "completed" },
			collapsed: true,
		},
	];
	const icons: Record<string, ReactNode> = {
		overdue: (
			<span
				className="icon-[solar--alarm-linear] size-3.5"
				style={{ color: "var(--q-red)" }}
				aria-hidden="true"
			/>
		),
		today: (
			<span
				className="icon-[solar--sun-2-linear] size-3.5"
				aria-hidden="true"
			/>
		),
		upcoming: (
			<span
				className="icon-[solar--calendar-linear] size-3.5"
				aria-hidden="true"
			/>
		),
		completed: (
			<span
				className="icon-[solar--check-circle-linear] size-3.5"
				style={{ color: "var(--q-green)" }}
				aria-hidden="true"
			/>
		),
	};
	return (
		<div className="page flush">
			<Header
				title="My Tasks"
				sub={`${groups[1]?.tasks.length ?? 0} due today · ${groups[0]?.tasks.length ?? 0} overdue · ${groups[2]?.tasks.length ?? 0} upcoming`}
				acts={
					<>
						<div className="seg" role="tablist" aria-label="View">
							{(
								[
									["list", "List", "icon-[solar--list-linear]"],
									["calendar", "Calendar", "icon-[solar--calendar-linear]"],
								] as const
							).map(([k, n, icon]) => (
								<button
									key={k}
									type="button"
									role="tab"
									aria-selected={mode === k}
									className={mode === k ? "on" : ""}
									onClick={() => setMode(k)}
								>
									<span className={`${icon} size-[13px]`} aria-hidden="true" />
									{n}
								</button>
							))}
						</div>
						<NewTaskButton prefill={{ assigneeId: meId }} />
					</>
				}
			/>
			<ViewToolbar
				view={view}
				setView={setView}
				fields={ALL_FIELDS}
				group={false}
			/>
			{mode === "calendar" ? (
				<CalendarView tasks={mine} storageKey="my" />
			) : (
				<div className="list-wrap">
					<ListView
						groups={groups}
						view={view}
						setView={setView}
						cols={["project", "status", "priority", "due"]}
						complete
						drag={false}
						groupIcon={(key) => icons[key]}
					/>
				</div>
			)}
		</div>
	);
}

function WsCalendar({ tasks }: { tasks: TaskItem[] }) {
	const names = useNames();
	const [view, setView] = useViewState("cal");
	return (
		<div className="page flush">
			<Header
				title="Calendar"
				sub="Deadlines and events across every project."
				acts={<NewTaskButton />}
			/>
			<ViewToolbar
				view={view}
				setView={setView}
				fields={ALL_FIELDS}
				group={false}
			/>
			<CalendarView tasks={applyView(tasks, view, names)} storageKey="ws" />
		</div>
	);
}

function WsTimeline({ slug, tasks }: { slug: string; tasks: TaskItem[] }) {
	const names = useNames();
	const [view, setView] = useViewState("tl");
	const [tl, setTl] = useTimelineState("ws", "project");
	const [todayTick, setTodayTick] = useState(0);
	const { data } = useQuery(MILESTONES, { variables: { slug } });
	const milestones = (data?.workspace?.projects ?? []).flatMap((p) =>
		p.milestones.map((m) => ({
			...m,
			color: projectColor(p.color),
			project: p.title,
		})),
	);
	return (
		<div className="page flush">
			<Header
				title="Timeline"
				sub="Schedules, dependencies, and milestones across projects."
			/>
			<ViewToolbar
				view={view}
				setView={setView}
				fields={ALL_FIELDS}
				group={false}
				extra={
					<TimelineControls
						state={tl}
						setState={setTl}
						onToday={() => setTodayTick((n) => n + 1)}
					/>
				}
			/>
			<TimelineView
				tasks={applyView(tasks, view, names)}
				milestones={milestones}
				zoom={tl.zoom}
				group={tl.group}
				todayTick={todayTick}
			/>
		</div>
	);
}
