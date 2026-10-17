import { useSuspenseQuery } from "@apollo/client/react";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PIcon, ProgBar, PStatus } from "#/components/projects/bits";
import { ProjectCard, progressOf } from "#/components/projects/project-card";
import { ProjectModal } from "#/components/projects/project-modal";
import { Av, AvStack } from "#/components/q/av";
import { Select } from "#/components/settings/ui";
import { ProjectsSkeleton } from "#/components/shell/page-skeletons";
import { ProjectMenu } from "#/components/shell/project-menu";
import {
	PROJECTS,
	type ProjectSummary,
	type SettingsMember,
} from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { PSTAT } from "#/lib/projects";
import { reloadOnEnter } from "#/lib/routing";
import { ago, fmtDay } from "#/lib/time";

// Ported from the reference app's Projects page: grid, list and table layouts.

const SORTS = [
	["recent", "Recently active"],
	["name", "Name"],
	["due", "Due date"],
	["progress", "Progress"],
] as const;
const LAYOUTS = [
	["grid", "Grid", "icon-[solar--widget-linear]"],
	["list", "List", "icon-[solar--list-linear]"],
	["table", "Table", "icon-[solar--table-linear]"],
] as const;

export const Route = createFileRoute("/_authed/w/$slug/projects")({
	validateSearch: z.object({
		q: z.string().optional(),
		status: z
			.enum(["all", ...(Object.keys(PSTAT) as [string, ...string[]])])
			.optional(),
		sort: z.enum(["recent", "name", "due", "progress"]).optional(),
		view: z.enum(["grid", "list", "table"]).optional(),
	}),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: PROJECTS,
			variables: { slug: params.slug },
			fetchPolicy: "network-only",
		});
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Projects - Zadaci" }] }),
	pendingComponent: ProjectsSkeleton,
	component: ProjectsPage,
});

function ProjectsPage() {
	const { slug } = Route.useParams();
	const {
		q = "",
		status = "all",
		sort = "recent",
		view = "grid",
	} = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(PROJECTS, { variables: { slug } });
	const [creating, setCreating] = useState(false);
	const workspace = data.workspace;
	if (!workspace) return null;

	const statsOf = (id: string) =>
		workspace.projectStats.find((s) => s.projectId === id);
	const people = (ids: string[]) =>
		ids.flatMap((id) => workspace.members.filter((m) => m.id === id));
	const setSearch = (patch: Record<string, string | undefined>) =>
		navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

	const query = q.trim().toLowerCase();
	const sorter: Record<string, (p: ProjectSummary) => string | number> = {
		recent: (p) => -new Date(statsOf(p.id)?.lastActivityAt ?? 0).getTime(),
		name: (p) => p.title.toLowerCase(),
		due: (p) => p.dueDate ?? "9999",
		progress: (p) => -progressOf(statsOf(p.id)),
	};
	const by = sorter[sort] ?? sorter.recent;
	const projects = workspace.projects
		.filter(
			(p) =>
				(status === "all" || p.status === status) &&
				(!query ||
					p.title.toLowerCase().includes(query) ||
					(p.description ?? "").toLowerCase().includes(query)),
		)
		.sort((a, b) => (by(a) > by(b) ? 1 : by(a) < by(b) ? -1 : 0));
	const active = workspace.projects.filter(
		(p) => p.status !== "complete",
	).length;
	const canCreate = can(workspace.role, "createProjects", workspace.settings);
	const open = (p: ProjectSummary) =>
		navigate({
			to: "/w/$slug/p/$projectId",
			params: { slug, projectId: p.id },
		});
	const menu = (p: ProjectSummary, className?: string) => (
		// biome-ignore lint/a11y/noStaticElementInteractions: keeps the menu click from opening the project
		// biome-ignore lint/a11y/useKeyWithClickEvents: only stops propagation; the trigger handles keys
		<span onClick={(e) => e.stopPropagation()}>
			<ProjectMenu
				slug={slug}
				project={p}
				index={0}
				count={1}
				allowed={(perm) => can(workspace.role, perm, workspace.settings)}
				className={className}
			/>
		</span>
	);

	let body: React.ReactNode;
	if (!workspace.projects.length)
		body = (
			<div className="panel">
				<div className="empty-state">
					<div className="glyph">
						<span
							className="icon-[solar--folder-with-files-linear] size-5"
							aria-hidden="true"
						/>
					</div>
					<h2 className="es-h">No projects yet</h2>
					<p>Create your first project to start organizing your work.</p>
					{canCreate && (
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => setCreating(true)}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
							Create project
						</button>
					)}
				</div>
			</div>
		);
	else if (!projects.length)
		body = (
			<div className="panel">
				<div className="empty-state">
					<div className="glyph">
						<span
							className="icon-[solar--magnifer-bug-linear] size-5"
							aria-hidden="true"
						/>
					</div>
					<h2 className="es-h">No results found</h2>
					<p>No projects match your search or filters. Try a different term.</p>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => setSearch({ q: undefined, status: undefined })}
					>
						Clear filters
					</button>
				</div>
			</div>
		);
	else if (view === "grid")
		body = (
			<div className="pgrid">
				{projects.map((p) => {
					const s = statsOf(p.id);
					return (
						<ProjectCard
							key={p.id}
							slug={slug}
							p={p}
							s={s}
							people={people(s?.memberIds ?? [])}
							menu={menu(p, "ibtn ibtn-sm more")}
						/>
					);
				})}
			</div>
		);
	else if (view === "list")
		body = (
			<div className="panel" style={{ overflow: "hidden" }}>
				{projects.map((p) => {
					const s = statsOf(p.id);
					const pct = progressOf(s);
					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: the title link is the keyboard target
						// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
						<div
							key={p.id}
							className="mini"
							style={{ minHeight: 52, gap: 12 }}
							onClick={() => open(p)}
						>
							<PIcon icon={p.icon} color={p.color} />
							<div className="grow" style={{ minWidth: 0 }}>
								<div className="row" style={{ gap: 6 }}>
									<Link
										to="/w/$slug/p/$projectId"
										params={{ slug, projectId: p.id }}
										style={{ fontWeight: 500 }}
										onClick={(e) => e.stopPropagation()}
									>
										{p.title}
									</Link>
									{p.access === "private" && (
										<span
											className="icon-[solar--lock-keyhole-linear] size-3"
											role="img"
											aria-label="Private project"
										/>
									)}
								</div>
								<div className="trunc faint" style={{ fontSize: 12 }}>
									{p.description}
								</div>
							</div>
							<span className="hide-m">
								<PStatus status={p.status} />
							</span>
							<span className="row hide-m" style={{ width: 140 }}>
								<ProgBar value={pct} />
								<span className="num faint" style={{ fontSize: 11.5 }}>
									{pct}%
								</span>
							</span>
							<span
								className="num muted hide-m"
								style={{ width: 70, fontSize: 12 }}
							>
								{fmtDay(p.dueDate)}
							</span>
							<AvStack people={people(s?.memberIds ?? [])} max={3} />
							{menu(p, "ibtn ibtn-sm")}
						</div>
					);
				})}
			</div>
		);
	else
		body = (
			<div className="panel" style={{ overflowX: "auto" }}>
				<table className="perm-t" style={{ minWidth: 860 }}>
					<thead>
						<tr>
							<th style={{ paddingLeft: 14 }}>Project</th>
							<th style={{ textAlign: "left" }}>Status</th>
							<th style={{ textAlign: "left" }}>Lead</th>
							<th style={{ textAlign: "left" }}>Team</th>
							<th style={{ textAlign: "left", width: "16%" }}>Progress</th>
							<th>Tasks</th>
							<th style={{ textAlign: "left" }}>Start</th>
							<th style={{ textAlign: "left" }}>Due</th>
							<th style={{ textAlign: "left" }}>Last activity</th>
							<th>
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{projects.map((p) => {
							const s = statsOf(p.id);
							const pct = progressOf(s);
							const lead = workspace.members.find((m) => m.id === p.leadId);
							return (
								<tr
									key={p.id}
									style={{ cursor: "pointer" }}
									onClick={() => open(p)}
								>
									<td style={{ paddingLeft: 14 }}>
										<span className="row">
											<PIcon icon={p.icon} color={p.color} px={14} />
											<Link
												to="/w/$slug/p/$projectId"
												params={{ slug, projectId: p.id }}
												style={{ fontWeight: 500 }}
												onClick={(e) => e.stopPropagation()}
											>
												{p.title}
											</Link>
										</span>
									</td>
									<td style={{ textAlign: "left" }}>
										<PStatus status={p.status} />
									</td>
									<td style={{ textAlign: "left" }}>
										<LeadCell lead={lead} />
									</td>
									<td style={{ textAlign: "left" }} className="muted">
										{workspace.teams.find((t) => t.id === p.teamId)?.name ??
											"—"}
									</td>
									<td>
										<span className="row">
											<ProgBar value={pct} />
											<span className="num faint" style={{ fontSize: 11.5 }}>
												{pct}%
											</span>
										</span>
									</td>
									<td className="num">{s?.total ?? 0}</td>
									<td style={{ textAlign: "left" }} className="num muted">
										{fmtDay(p.startDate)}
									</td>
									<td style={{ textAlign: "left" }} className="num muted">
										{fmtDay(p.dueDate)}
									</td>
									<td
										style={{ textAlign: "left" }}
										className="muted"
										suppressHydrationWarning
									>
										{s?.lastActivityAt ? ago(s.lastActivityAt) : "—"}
									</td>
									<td>{menu(p, "ibtn ibtn-sm")}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);

	return (
		<div className="page wide">
			<div className="ph">
				<div>
					<h1>Projects</h1>
					<p>
						{active} active · {workspace.projects.length - active} completed
					</p>
				</div>
				{canCreate && (
					<div className="acts">
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
					</div>
				)}
			</div>
			<div
				className="row"
				style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}
			>
				<div className="inwrap">
					<span
						className="i icon-[solar--magnifer-linear] size-[13px]"
						aria-hidden="true"
					/>
					<input
						className="input search-sm"
						placeholder="Search projects"
						aria-label="Search projects"
						value={q}
						onChange={(e) => setSearch({ q: e.target.value || undefined })}
					/>
				</div>
				<Select
					label="Filter by status"
					value={status}
					options={[
						["all", "All statuses"],
						...Object.entries(PSTAT).map(([k, v]) => [k, v.name] as const),
					]}
					onChange={(v) => setSearch({ status: v === "all" ? undefined : v })}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<Select
					label="Sort"
					value={sort}
					options={SORTS.map(([k, n]) => [k, `Sort: ${n}`] as const)}
					onChange={(v) => setSearch({ sort: v === "recent" ? undefined : v })}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<span className="sp" />
				<div className="seg" role="tablist" aria-label="Layout">
					{LAYOUTS.map(([k, n, icon]) => (
						<button
							key={k}
							type="button"
							role="tab"
							aria-selected={view === k}
							aria-label={n}
							className={view === k ? "on" : ""}
							onClick={() => setSearch({ view: k === "grid" ? undefined : k })}
						>
							<span className={`${icon} size-[13px]`} aria-hidden="true" />
							<span className="hide-m">{n}</span>
						</button>
					))}
				</div>
			</div>
			{body}
			{canCreate && (
				<ProjectModal
					open={creating}
					onOpenChange={setCreating}
					slug={slug}
					members={workspace.members}
					teams={workspace.teams}
				/>
			)}
		</div>
	);
}

function LeadCell({ lead }: { lead: SettingsMember | undefined }) {
	if (!lead) return <span className="faint">—</span>;
	return (
		<span className="row">
			<Av name={lead.name} image={lead.image} className="sm" />
			{lead.name}
		</span>
	);
}
