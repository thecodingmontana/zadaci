import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import { MemberActions } from "#/components/settings/workspace-group";
import {
	ACTIVITY,
	MEMBER_PROFILE,
	MEMBER_STATS,
	type ProfileTask,
	SETTINGS,
} from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { ROLE_LABEL } from "#/lib/preferences";
import { reloadOnEnter } from "#/lib/routing";
import { isClosed } from "#/lib/tasks";
import { ago, fmtDay } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { isOverdue } from "#/lib/view-engine";

// Ported from the reference app's member profile page.

export const Route = createFileRoute("/_authed/w/$slug/members/$memberId")({
	validateSearch: z.object({
		tab: z.enum(["assigned", "completed"]).optional(),
	}),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { slug, memberId } = params;
		const q = context.apolloClient.query;
		const [{ data }] = await Promise.all([
			q({ query: SETTINGS, variables: { slug }, fetchPolicy: "network-only" }),
			q({
				query: MEMBER_STATS,
				variables: { slug },
				fetchPolicy: "network-only",
			}),
			q({
				query: MEMBER_PROFILE,
				variables: { slug, memberId },
				fetchPolicy: "network-only",
			}),
		]);
		const member = data?.workspace?.members.find((m) => m.id === memberId);
		if (!member) throw notFound();
		// recent activity is filtered by the person's user id
		await q({
			query: ACTIVITY,
			variables: { slug, filter: "all", actorId: member.userId },
			fetchPolicy: "network-only",
		});
		return { name: member.name, userId: member.userId };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.name ?? "Member"} - Zadaci` }],
	}),
	component: MemberPage,
});

function MemberPage() {
	const { slug, memberId } = Route.useParams();
	const { userId } = Route.useLoaderData();
	const { tab = "assigned" } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data } = useSuspenseQuery(SETTINGS, { variables: { slug } });
	const { data: statsData } = useSuspenseQuery(MEMBER_STATS, {
		variables: { slug },
	});
	const { data: profileData } = useSuspenseQuery(MEMBER_PROFILE, {
		variables: { slug, memberId },
	});
	const { data: activityData } = useSuspenseQuery(ACTIVITY, {
		variables: { slug, filter: "all", actorId: userId },
	});
	const workspace = data.workspace;
	const m = workspace?.members.find((x) => x.id === memberId);
	if (!workspace || !m) return null;
	const stat = statsData.workspace?.memberStats.find(
		(s) => s.memberId === m.id,
	);
	const team = workspace.teams.find((t) => t.id === stat?.teamIds[0]);
	const profile = profileData.workspace?.memberProfile;
	const tasks = profile?.tasks ?? [];
	const open = tasks.filter((t) => !isClosed(t.status));
	const done = tasks.filter((t) => isClosed(t.status));
	const overdue = open.filter((t) => isOverdue(t)).length;
	const projects = profile?.projects ?? [];
	const acts = (activityData.workspace?.activity ?? []).slice(0, 8);
	const last = stat?.lastActiveAt;
	const online = !!last && Date.now() - new Date(last).getTime() < 5 * 60_000;
	const list = tab === "assigned" ? open : done;

	return (
		<div className="page">
			<div
				className="row"
				style={{
					gap: 18,
					marginBottom: 22,
					flexWrap: "wrap",
					alignItems: "flex-start",
				}}
			>
				<Av
					name={m.name}
					image={m.image}
					className={cn("xl", online && "presence")}
				/>
				<div className="grow" style={{ minWidth: 220 }}>
					<div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
						<h1
							style={{
								fontSize: "var(--q-fs-2xl)",
								margin: 0,
								fontWeight: 600,
								letterSpacing: "-.02em",
							}}
						>
							{m.name}
						</h1>
						<span className="badge">
							{m.role === "owner" && (
								<span
									className="icon-[solar--crown-linear] size-[11px]"
									aria-hidden="true"
								/>
							)}
							{ROLE_LABEL[m.role]}
						</span>
					</div>
					<div className="muted" style={{ marginTop: 3 }}>
						{[m.title, team?.name ?? "No team"].filter(Boolean).join(" · ")}
					</div>
					<div
						className="row faint"
						style={{ marginTop: 8, gap: 14, fontSize: 12.5, flexWrap: "wrap" }}
					>
						<span className="row" style={{ gap: 5 }}>
							<span
								className="icon-[solar--letter-linear] size-[13px]"
								aria-hidden="true"
							/>
							<span style={{ userSelect: "all" }}>{m.email}</span>
						</span>
						{m.tz && (
							<span className="row" style={{ gap: 5 }}>
								<span
									className="icon-[solar--map-point-linear] size-[13px]"
									aria-hidden="true"
								/>
								{m.tz}
							</span>
						)}
						<span className="row" style={{ gap: 5 }} suppressHydrationWarning>
							<span
								className="icon-[solar--clock-circle-linear] size-[13px]"
								aria-hidden="true"
							/>
							{!last
								? "Never signed in"
								: online
									? "Online now"
									: `Active ${ago(last)}`}
						</span>
					</div>
				</div>
				<div className="row">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={async () => {
							await navigator.clipboard.writeText(m.email);
							toast.success("Email copied");
						}}
					>
						<span
							className="icon-[solar--copy-linear] size-3.5"
							aria-hidden="true"
						/>
						Copy email
					</button>
					<MemberActions
						slug={slug}
						m={m}
						canAdmin={can(workspace.role, "manageRoles")}
						openTasks={open.length}
					/>
				</div>
			</div>
			<div className="stats" style={{ marginBottom: 18 }}>
				<div className="stat">
					<span className="k">Active projects</span>
					<span className="v">{projects.length}</span>
				</div>
				<div className="stat">
					<span className="k">Assigned tasks</span>
					<span className="v">{open.length}</span>
				</div>
				<div className="stat">
					<span className="k">Completed tasks</span>
					<span className="v">{done.length}</span>
				</div>
				<div className="stat">
					<span className="k">Overdue</span>
					<span
						className="v"
						style={overdue ? { color: "var(--q-red)" } : undefined}
					>
						{overdue}
					</span>
				</div>
			</div>
			<div className="grid2">
				<section className="panel" style={{ alignSelf: "start" }}>
					<div className="tabs" role="tablist" style={{ padding: "0 8px" }}>
						{(
							[
								["assigned", `Assigned · ${open.length}`],
								["completed", `Completed · ${done.length}`],
							] as const
						).map(([k, label]) => (
							<button
								key={k}
								type="button"
								role="tab"
								aria-selected={tab === k}
								className={tab === k ? "tab on" : "tab"}
								onClick={() =>
									navigate({
										search: { tab: k === "assigned" ? undefined : k },
										replace: true,
									})
								}
							>
								{label}
							</button>
						))}
					</div>
					{list.length ? (
						list.map((t) => <TaskRow key={t.id} slug={slug} t={t} />)
					) : (
						<div className="empty-state sm">
							<div className="glyph">
								<span
									className="icon-[solar--checklist-minimalistic-linear] size-5"
									aria-hidden="true"
								/>
							</div>
							<h2 className="es-h">No tasks here</h2>
							<p>Nothing to show in this list.</p>
						</div>
					)}
				</section>
				<div className="stack">
					<section className="panel">
						<div className="panel-h">
							<h2>Active projects</h2>
						</div>
						{projects.length ? (
							projects.map((p) => (
								<Link
									key={p.id}
									to="/w/$slug/p/$projectId"
									params={{ slug, projectId: p.id }}
									className="mini"
								>
									<span
										className="pico"
										style={
											{
												"--c": projectColor(p.color),
											} as React.CSSProperties
										}
									>
										<span
											className={cn(
												p.icon ?? "icon-[solar--folder-linear]",
												"i size-3",
											)}
											aria-hidden="true"
										/>
									</span>
									<span className="tt">{p.title}</span>
									<span className="faint" style={{ fontSize: 12 }}>
										Member
									</span>
								</Link>
							))
						) : (
							<div className="panel-b faint">No active projects</div>
						)}
					</section>
					<section className="panel">
						<div className="panel-h">
							<h2>Recent activity</h2>
						</div>
						<div className="panel-b feed">
							{acts.length ? (
								acts.map((a) => (
									<div key={a.id} className="fitem">
										<Av name={m.name} image={m.image} className="sm" />
										<div className="grow">
											<b>{m.name}</b> <span className="muted">{a.verb}</span>{" "}
											{a.target &&
												(a.projectId ? (
													<Link
														to="/w/$slug/p/$projectId"
														params={{ slug, projectId: a.projectId }}
														className="obj"
													>
														{a.target}
													</Link>
												) : (
													<b>{a.target}</b>
												))}{" "}
											{a.extra && <span className="muted">{a.extra}</span>}
										</div>
										<time dateTime={a.createdAt} suppressHydrationWarning>
											{ago(a.createdAt)}
										</time>
									</div>
								))
							) : (
								<span className="faint">No recent activity</span>
							)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

/** A task line like the reference miniRow; opens its project until the task drawer exists. */
function TaskRow({ slug, t }: { slug: string; t: ProfileTask }) {
	const done = isClosed(t.status);
	return (
		<Link
			to="/w/$slug/p/$projectId"
			params={{ slug, projectId: t.projectId }}
			className={cn("mini", done && "done")}
		>
			<StatusIcon status={t.status} />
			<span className="tt">{t.name}</span>
			<span className="pj hide-m">
				<span
					className="pdot"
					style={
						{
							"--c": projectColor(t.projectColor),
						} as React.CSSProperties
					}
				/>
				<span className="trunc">{t.projectTitle}</span>
			</span>
			<span
				className="hide-m"
				style={{
					width: 74,
					textAlign: "right",
					fontSize: 12,
					color: isOverdue(t) ? "var(--q-red)" : "var(--q-text-3)",
				}}
			>
				{t.dueDate ? fmtDay(t.dueDate) : ""}
			</span>
		</Link>
	);
}
