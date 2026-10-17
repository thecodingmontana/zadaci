import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useState } from "react";
import { ActivityItem } from "#/components/activity/activity-item";
import {
	PIcon,
	ProgBar,
	PStatus,
	projectColor,
} from "#/components/projects/bits";
import { ProjectModal } from "#/components/projects/project-modal";
import { Av, AvStack } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import { InviteModal } from "#/components/settings/workspace-group";
import { PrIcon } from "#/components/tasks/bits";
import { TaskViewProvider, useTaskView } from "#/components/tasks/context";
import { MiniRow } from "#/components/tasks/mini-row";
import { useNewTask } from "#/components/tasks/new-task";
import {
	ACTIVITY,
	PROJECTS,
	TASKS,
	type TaskItem,
	WORKSPACE,
} from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { reloadOnEnter } from "#/lib/routing";
import { isClosed } from "#/lib/tasks";
import { cn } from "#/lib/utils";
import { isOverdue, sortTasks } from "#/lib/view-engine";

// Ported from the reference app's Home page: greeting, stats, my tasks, project
// progress, upcoming deadlines and recent activity.

const WEEK_MS = 7 * 86_400_000;

export const Route = createFileRoute("/_authed/w/$slug/")({
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const q = context.apolloClient.query;
		const variables = { slug: params.slug };
		const [{ data }] = await Promise.all([
			q({ query: WORKSPACE, variables }),
			q({ query: TASKS, variables, fetchPolicy: "network-only" }),
			q({ query: PROJECTS, variables, fetchPolicy: "network-only" }),
			q({
				query: ACTIVITY,
				variables: { ...variables, filter: "all" },
				fetchPolicy: "network-only",
			}),
		]);
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Home - Zadaci" }] }),
	component: WorkspaceHome,
});

function WorkspaceHome() {
	const { slug } = Route.useParams();
	const { data } = useSuspenseQuery(TASKS, { variables: { slug } });
	if (!data.workspace) return null;
	return (
		<TaskViewProvider
			slug={slug}
			members={data.workspace.members}
			projects={data.workspace.projects}
		>
			<Home slug={slug} tasks={data.workspace.tasks} />
		</TaskViewProvider>
	);
}

type Tab = "upcoming" | "overdue" | "completed";

function Home({ slug, tasks }: { slug: string; tasks: TaskItem[] }) {
	const { user } = Route.useRouteContext();
	const { meId } = useTaskView();
	const newTask = useNewTask();
	const ws = useSuspenseQuery(WORKSPACE, { variables: { slug } }).data
		.workspace;
	const pj = useSuspenseQuery(PROJECTS, { variables: { slug } }).data.workspace;
	const feed = useSuspenseQuery(ACTIVITY, {
		variables: { slug, filter: "all" },
	}).data.workspace;
	const [tab, setTab] = useState<Tab>("upcoming");
	const [inviting, setInviting] = useState(false);
	const [creating, setCreating] = useState(false);
	if (!ws || !pj) return null;

	const now = new Date();
	const h = now.getHours();
	const greet =
		h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
	const mine = tasks.filter((t) => t.assigneeId === meId);
	const active = pj.projects.filter((p) => p.status !== "complete");
	const open = tasks.filter((t) => !isClosed(t.status));
	const doneWk = tasks.filter(
		(t) =>
			t.status === "completed" &&
			t.completedAt &&
			now.getTime() - Date.parse(t.completedAt) < WEEK_MS,
	);
	const over = tasks.filter((t) => isOverdue(t));
	const lists: Record<Tab, TaskItem[]> = {
		upcoming: sortTasks(
			mine.filter((t) => !isClosed(t.status) && !isOverdue(t)),
			{ f: "due", dir: 1 },
		),
		overdue: mine.filter((t) => isOverdue(t)),
		completed: sortTasks(
			mine.filter((t) => t.status === "completed"),
			{ f: "updated", dir: 1 },
		),
	};
	const cur = lists[tab].slice(0, 7);
	const due = (a: number, b: number) =>
		sortTasks(
			open.filter((t) => {
				if (!t.dueDate) return false;
				const n = differenceInCalendarDays(parseISO(t.dueDate), now);
				return n >= a && n <= b;
			}),
			{ f: "priority", dir: 1 },
		);
	const deadlines = [
		["Today", due(0, 0)],
		["Tomorrow", due(1, 1)],
		["This week", due(2, 7)],
	] as const;
	const statsOf = (id: string) =>
		pj.projectStats.find((s) => s.projectId === id);
	const canInvite =
		can(pj.role, "inviteMembers") || can(pj.role, "inviteGuests", pj.settings);
	const canCreate = can(pj.role, "createProjects", pj.settings);

	return (
		<div className="page">
			<div className="ph">
				<div>
					<h1 suppressHydrationWarning>
						{greet}, {user.name.split(" ")[0]}
					</h1>
					<p>
						<span className="num" suppressHydrationWarning>
							{format(now, "EEEE, MMMM d")}
						</span>{" "}
						· Here's what's happening across your workspace.
					</p>
				</div>
				<div className="acts">
					{canInvite && (
						<button
							type="button"
							className="btn btn-secondary hide-m"
							onClick={() => setInviting(true)}
						>
							<span
								className="icon-[solar--user-plus-linear] size-3.5"
								aria-hidden="true"
							/>
							Invite member
						</button>
					)}
					{canCreate && (
						<button
							type="button"
							className="btn btn-secondary hide-m"
							onClick={() => setCreating(true)}
						>
							<span
								className="icon-[solar--add-folder-linear] size-3.5"
								aria-hidden="true"
							/>
							New project
						</button>
					)}
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => newTask()}
					>
						<span
							className="icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
						New task
					</button>
				</div>
			</div>

			<div className="stats" style={{ marginBottom: 16 }}>
				<Link to="/w/$slug/projects" params={{ slug }} className="stat">
					<span className="k">
						<span
							className="icon-[solar--folder-with-files-linear] size-3.5"
							aria-hidden="true"
						/>
						Active projects
					</span>
					<span className="v">{active.length}</span>
					<span className="d">
						{active.filter((p) => p.status === "risk").length} at risk
					</span>
				</Link>
				<Link to="/w/$slug/tasks" params={{ slug }} className="stat">
					<span className="k">
						<StatusIcon status="todo" size={14} />
						Open tasks
					</span>
					<span className="v">{open.length}</span>
					<span className="d">
						{open.filter((t) => t.assigneeId === meId).length} assigned to you
					</span>
				</Link>
				<Link to="/w/$slug/tasks" params={{ slug }} className="stat">
					<span className="k">
						<span
							className="icon-[solar--check-circle-linear] size-3.5"
							aria-hidden="true"
						/>
						Completed
					</span>
					<span className="v">{doneWk.length}</span>
					<span className="d up">this week</span>
				</Link>
				<Link to="/w/$slug/my-tasks" params={{ slug }} className="stat">
					<span className="k">
						<span
							className="icon-[solar--alarm-linear] size-3.5"
							aria-hidden="true"
						/>
						Overdue
					</span>
					<span
						className="v"
						style={over.length ? { color: "var(--q-red)" } : undefined}
					>
						{over.length}
					</span>
					<span className={cn("d", over.length && "bad")}>
						{over.length ? "need attention" : "all on track"}
					</span>
				</Link>
			</div>

			<div className="grid2">
				<div className="stack">
					<section className="panel" aria-labelledby="h-mytasks">
						<div className="panel-h">
							<h2 id="h-mytasks">My tasks</h2>
							<div className="acts">
								<div className="seg" role="tablist">
									{(
										[
											["upcoming", "Upcoming"],
											["overdue", "Overdue"],
											["completed", "Completed"],
										] as const
									).map(([k, n]) => (
										<button
											key={k}
											type="button"
											role="tab"
											aria-selected={tab === k}
											className={tab === k ? "on" : ""}
											onClick={() => setTab(k)}
										>
											{n} <span className="faint">{lists[k].length}</span>
										</button>
									))}
								</div>
								<Link
									to="/w/$slug/my-tasks"
									params={{ slug }}
									className="ibtn ibtn-sm"
									data-tip="Open My Tasks"
									aria-label="Open My Tasks"
								>
									<span
										className="icon-[solar--arrow-right-up-linear] size-[15px]"
										aria-hidden="true"
									/>
								</Link>
							</div>
						</div>
						{cur.length ? (
							cur.map((t) => <MiniRow key={t.id} t={t} av={false} />)
						) : (
							<div className="empty-state sm">
								<div className="glyph">
									<span
										className={cn(
											tab === "overdue"
												? "icon-[solar--check-circle-linear]"
												: "icon-[solar--checklist-minimalistic-linear]",
											"size-5",
										)}
										aria-hidden="true"
									/>
								</div>
								<h3 className="es-h">
									{tab === "overdue" ? "Nothing overdue" : "No tasks here"}
								</h3>
								<p>
									{tab === "overdue"
										? "Every task assigned to you is on schedule."
										: "Add a task to get things moving."}
								</p>
							</div>
						)}
						{lists[tab].length > 7 && (
							<Link
								to="/w/$slug/my-tasks"
								params={{ slug }}
								className="addrow"
								style={{
									paddingLeft: 14,
									borderTop: "1px solid var(--q-divider)",
									borderBottom: 0,
								}}
							>
								View all {lists[tab].length} tasks
								<span
									className="icon-[solar--arrow-right-linear] size-[13px]"
									aria-hidden="true"
								/>
							</Link>
						)}
					</section>

					<section className="panel">
						<div className="panel-h">
							<h2>Project progress</h2>
							<div className="acts">
								<Link
									to="/w/$slug/projects"
									params={{ slug }}
									className="btn btn-sm btn-ghost"
								>
									All projects
								</Link>
							</div>
						</div>
						<div style={{ overflowX: "auto" }}>
							<table className="perm-t" style={{ minWidth: 560 }}>
								<thead>
									<tr>
										<th style={{ paddingLeft: 14 }}>Project</th>
										<th style={{ textAlign: "left" }}>Status</th>
										<th style={{ textAlign: "left", width: "26%" }}>
											Progress
										</th>
										<th style={{ textAlign: "left" }}>Due</th>
										<th style={{ textAlign: "right", paddingRight: 14 }}>
											Team
										</th>
									</tr>
								</thead>
								<tbody>
									{active.map((p) => {
										const s = statsOf(p.id);
										const pct = s?.total
											? Math.round((s.done / s.total) * 100)
											: 0;
										return (
											<tr key={p.id}>
												<td style={{ paddingLeft: 14 }}>
													<Link
														to="/w/$slug/p/$projectId"
														params={{ slug, projectId: p.id }}
														search={{ tab: "overview" }}
														className="row"
													>
														<PIcon icon={p.icon} color={p.color} px={14} />
														<b style={{ fontWeight: 500 }}>{p.title}</b>
													</Link>
												</td>
												<td style={{ textAlign: "left" }}>
													<PStatus status={p.status} />
												</td>
												<td>
													<span className="row">
														<ProgBar
															value={pct}
															tone={p.status === "risk" ? "red" : undefined}
														/>
														<span
															className="num faint"
															style={{ fontSize: 11.5, width: 30 }}
														>
															{pct}%
														</span>
													</span>
												</td>
												<td style={{ textAlign: "left" }} className="num muted">
													{p.dueDate
														? format(parseISO(p.dueDate), "MMM d")
														: "—"}
												</td>
												<td style={{ textAlign: "right", paddingRight: 14 }}>
													<AvStack
														people={(s?.memberIds ?? []).flatMap((id) =>
															pj.members.filter((m) => m.id === id),
														)}
														max={3}
													/>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>

				<div className="stack">
					<section className="panel">
						<div className="panel-h">
							<h2>Upcoming deadlines</h2>
							<div className="acts">
								<Link
									to="/w/$slug/calendar"
									params={{ slug }}
									className="btn btn-sm btn-ghost"
								>
									<span
										className="icon-[solar--calendar-linear] size-[13px]"
										aria-hidden="true"
									/>
									Calendar
								</Link>
							</div>
						</div>
						<div className="panel-b" style={{ paddingBottom: 6 }}>
							{deadlines.map(([label, list]) => (
								<div key={label} style={{ marginBottom: 10 }}>
									<div
										className="row"
										style={{
											fontSize: 11.5,
											fontWeight: 600,
											color: "var(--q-text-2)",
											marginBottom: 4,
										}}
									>
										{label}
										<span className="faint" style={{ fontWeight: 500 }}>
											{list.length}
										</span>
									</div>
									{list.length ? (
										<>
											{list.slice(0, 4).map((t) => (
												<DeadlineRow key={t.id} t={t} />
											))}
											{list.length > 4 && (
												<div
													className="faint"
													style={{ fontSize: 11.5, paddingLeft: 16 }}
												>
													+{list.length - 4} more
												</div>
											)}
										</>
									) : (
										<div
											className="faint"
											style={{ fontSize: 12.5, padding: "4px 0 2px" }}
										>
											Nothing due
										</div>
									)}
								</div>
							))}
						</div>
					</section>

					<section className="panel">
						<div className="panel-h">
							<h2>Recent activity</h2>
							<div className="acts">
								<Link
									to="/w/$slug/activity"
									params={{ slug }}
									className="btn btn-sm btn-ghost"
								>
									View all
								</Link>
							</div>
						</div>
						<div className="panel-b feed lined">
							{feed?.activity.length ? (
								feed.activity
									.slice(0, 7)
									.map((a) => (
										<ActivityItem key={a.id} slug={slug} a={a} meId={user.id} />
									))
							) : (
								<span className="faint">No activity yet</span>
							)}
						</div>
					</section>
				</div>
			</div>

			{canInvite && (
				<InviteModal
					open={inviting}
					onOpenChange={setInviting}
					slug={slug}
					workspace={{ ...pj, name: ws.name, inviteCode: ws.inviteCode }}
				/>
			)}
			{canCreate && (
				<ProjectModal
					open={creating}
					onOpenChange={setCreating}
					slug={slug}
					members={pj.members}
					teams={pj.teams}
				/>
			)}
		</div>
	);
}

function DeadlineRow({ t }: { t: TaskItem }) {
	const { openTask, project, member } = useTaskView();
	const m = member(t.assigneeId);
	return (
		<button
			type="button"
			className="row"
			style={{
				height: 30,
				gap: 8,
				fontSize: 13,
				width: "100%",
				textAlign: "left",
			}}
			onClick={() => openTask(t.id)}
		>
			<span
				className="pdot"
				style={
					{
						"--c": projectColor(project(t.projectId)?.color),
					} as React.CSSProperties
				}
			/>
			<span className="trunc grow">{t.name}</span>
			<PrIcon p={t.priority} size={13} />
			{m && <Av name={m.name} image={m.image} className="sm" />}
		</button>
	);
}
