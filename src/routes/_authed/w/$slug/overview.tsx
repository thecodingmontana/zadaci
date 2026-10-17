import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
	PIcon,
	ProgBar,
	PStatus,
	projectColor,
} from "#/components/projects/bits";
import { progressOf } from "#/components/projects/project-card";
import { ProjectModal } from "#/components/projects/project-modal";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import { OVERVIEW, PROJECTS, TASKS } from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { reloadOnEnter } from "#/lib/routing";
import { TASK_STATUSES } from "#/lib/tasks";
import { daysUntil, fmtDay, relDay } from "#/lib/time";

// Ported from the reference app's Workspace overview: portfolio, status mix, workload
// and upcoming milestones.

export const Route = createFileRoute("/_authed/w/$slug/overview")({
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const q = context.apolloClient.query;
		const variables = { slug: params.slug };
		const [{ data }] = await Promise.all([
			q({ query: OVERVIEW, variables, fetchPolicy: "network-only" }),
			q({ query: PROJECTS, variables, fetchPolicy: "network-only" }),
			q({ query: TASKS, variables, fetchPolicy: "network-only" }),
		]);
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Overview - Zadaci" }] }),
	component: OverviewPage,
});

function OverviewPage() {
	const { slug } = Route.useParams();
	const ov = useSuspenseQuery(OVERVIEW, { variables: { slug } }).data.workspace;
	const pj = useSuspenseQuery(PROJECTS, { variables: { slug } }).data.workspace;
	const tk = useSuspenseQuery(TASKS, { variables: { slug } }).data.workspace;
	const [creating, setCreating] = useState(false);
	if (!ov || !pj || !tk) return null;

	const all = tk.tasks;
	const done = all.filter((t) => t.status === "completed").length;
	const pct = (n: number) => Math.round((n / Math.max(all.length, 1)) * 100);
	const counts = TASK_STATUSES.map((s) => ({
		s,
		n: all.filter((t) => t.status === s.id).length,
	}));
	const statsOf = (id: string) =>
		pj.projectStats.find((s) => s.projectId === id);
	const load = pj.members
		.map((m) => ({
			m,
			ts: all.filter((t) => t.assigneeId === m.id && t.status !== "completed"),
		}))
		.sort((a, b) => b.ts.length - a.ts.length);
	const maxL = Math.max(...load.map((l) => l.ts.length), 1);
	const milestones = ov.projects
		.flatMap((p) => p.milestones.map((m) => ({ ...m, p })))
		.filter((m) => daysUntil(m.date) >= 0)
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(0, 6);
	const canCreate = can(pj.role, "createProjects", pj.settings);

	return (
		<div className="page">
			<div className="ph">
				<div>
					<h1>Workspace overview</h1>
					<p>Health of every project in {ov.name}.</p>
				</div>
				<div className="acts">
					<Link
						to="/w/$slug/timeline"
						params={{ slug }}
						className="btn btn-secondary"
					>
						<span
							className="icon-[hugeicons--chart-gantt] size-3.5"
							aria-hidden="true"
						/>
						Timeline
					</Link>
					{canCreate && (
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => setCreating(true)}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
							New project
						</button>
					)}
				</div>
			</div>

			<div className="stats" style={{ marginBottom: 16 }}>
				<div className="stat">
					<span className="k">Projects</span>
					<span className="v">{pj.projects.length}</span>
					<span className="d">
						{pj.projects.filter((p) => p.status === "complete").length}{" "}
						completed
					</span>
				</div>
				<div className="stat">
					<span className="k">Tasks</span>
					<span className="v">{all.length}</span>
					<span className="d">{all.length - done} open</span>
				</div>
				<div className="stat">
					<span className="k">Completion rate</span>
					<span className="v">{pct(done)}%</span>
					<span className="d">across all projects</span>
				</div>
				<div className="stat">
					<span className="k">Members</span>
					<span className="v">{pj.members.length}</span>
					<span className="d">{ov.invites.length} pending invite</span>
				</div>
			</div>

			<div className="grid2">
				<section className="panel">
					<div className="panel-h">
						<h2>Portfolio</h2>
					</div>
					<div style={{ overflowX: "auto" }}>
						<table className="perm-t" style={{ minWidth: 600 }}>
							<thead>
								<tr>
									<th style={{ paddingLeft: 14 }}>Project</th>
									<th style={{ textAlign: "left" }}>Lead</th>
									<th style={{ textAlign: "left" }}>Status</th>
									<th style={{ textAlign: "left", width: "22%" }}>Progress</th>
									<th>Open</th>
									<th>Overdue</th>
									<th style={{ textAlign: "left" }}>Due</th>
								</tr>
							</thead>
							<tbody>
								{pj.projects.map((p) => {
									const s = statsOf(p.id);
									const pr = progressOf(s);
									const overdue = s?.overdue ?? 0;
									const lead = pj.members.find((m) => m.id === p.leadId);
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
													<span className="trunc" style={{ fontWeight: 500 }}>
														{p.title}
													</span>
												</Link>
											</td>
											<td style={{ textAlign: "left" }}>
												{lead ? (
													<span className="row">
														<Av
															name={lead.name}
															image={lead.image}
															className="sm"
														/>
														<span className="muted trunc">
															{lead.name.split(" ")[0]}
														</span>
													</span>
												) : (
													<span className="faint">—</span>
												)}
											</td>
											<td style={{ textAlign: "left" }}>
												<PStatus status={p.status} />
											</td>
											<td>
												<span className="row">
													<ProgBar
														value={pr}
														tone={
															p.status === "complete"
																? "green"
																: p.status === "risk"
																	? "red"
																	: undefined
														}
													/>
													<span
														className="num faint"
														style={{ fontSize: 11.5, width: 30 }}
													>
														{pr}%
													</span>
												</span>
											</td>
											<td className="num">
												{(s?.total ?? 0) - (s?.done ?? 0)}
											</td>
											<td
												className="num"
												style={{
													color: overdue ? "var(--q-red)" : "var(--q-text-3)",
												}}
											>
												{overdue}
											</td>
											<td style={{ textAlign: "left" }} className="num muted">
												{fmtDay(p.dueDate)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>

				<div className="stack">
					<section className="panel">
						<div className="panel-h">
							<h2>Tasks by status</h2>
						</div>
						<div className="panel-b">
							<div
								className="stackbar"
								style={{ height: 10, marginBottom: 12 }}
							>
								{counts.map(({ s, n }) => (
									<i
										key={s.id}
										style={{
											width: `${pct(n)}%`,
											background: `var(--q-st-${s.st})`,
										}}
										title={`${s.name}: ${n}`}
									/>
								))}
							</div>
							{counts.map(({ s, n }) => (
								<div
									key={s.id}
									className="row"
									style={{ height: 28, fontSize: 13 }}
								>
									<StatusIcon status={s.id} />
									<span className="grow">{s.name}</span>
									<span className="num muted">{n}</span>
									<span
										className="num faint"
										style={{ width: 36, textAlign: "right" }}
									>
										{pct(n)}%
									</span>
								</div>
							))}
						</div>
					</section>

					<section className="panel">
						<div className="panel-h">
							<h2>Workload</h2>
							<div className="acts">
								<span className="faint" style={{ fontSize: 11.5 }}>
									Open tasks per person
								</span>
							</div>
						</div>
						<div className="panel-b">
							{load.map(({ m, ts }) => (
								<Link
									key={m.id}
									to="/w/$slug/members/$memberId"
									params={{ slug, memberId: m.id }}
									className="row"
									style={{ height: 30, fontSize: 13 }}
								>
									<Av name={m.name} image={m.image} className="sm" />
									<span style={{ width: 96 }} className="trunc">
										{m.name.split(" ")[0]}
									</span>
									<span
										className="grow"
										style={{
											display: "flex",
											height: 8,
											borderRadius: 4,
											overflow: "hidden",
											background: "var(--q-surface-3)",
										}}
									>
										<span
											style={{
												display: "flex",
												width: `${(ts.length / maxL) * 100}%`,
											}}
										>
											{TASK_STATUSES.filter((s) => s.id !== "completed").map(
												(s) => {
													const n = ts.filter((t) => t.status === s.id).length;
													return n ? (
														<i
															key={s.id}
															style={{
																display: "block",
																flex: n,
																background: `var(--q-st-${s.st})`,
															}}
														/>
													) : null;
												},
											)}
										</span>
									</span>
									<span
										className="num muted"
										style={{ width: 22, textAlign: "right" }}
									>
										{ts.length}
									</span>
								</Link>
							))}
						</div>
					</section>

					<section className="panel">
						<div className="panel-h">
							<h2>Upcoming milestones</h2>
						</div>
						<div className="panel-b">
							{milestones.length ? (
								milestones.map((m) => (
									<Link
										key={m.id}
										to="/w/$slug/p/$projectId"
										params={{ slug, projectId: m.p.id }}
										search={{ tab: "timeline" }}
										className="row"
										style={{ height: 32, fontSize: 13 }}
									>
										<span
											style={{
												width: 9,
												height: 9,
												transform: "rotate(45deg)",
												background: projectColor(m.p.color),
												borderRadius: 2,
												flexShrink: 0,
												margin: "0 3px",
											}}
											aria-hidden="true"
										/>
										<span className="grow trunc">
											{m.name} <span className="faint">· {m.p.title}</span>
										</span>
										<span className="num muted" suppressHydrationWarning>
											{relDay(m.date)}
										</span>
									</Link>
								))
							) : (
								<div className="faint">No upcoming milestones</div>
							)}
						</div>
					</section>
				</div>
			</div>
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
