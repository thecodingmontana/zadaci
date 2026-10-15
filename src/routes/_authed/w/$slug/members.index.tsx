import { useSuspenseQuery } from "@apollo/client/react";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Av } from "#/components/q/av";
import {
	InviteActions,
	InviteModal,
	MemberActions,
	MemberRole,
	PermissionsTable,
	TeamsGrid,
} from "#/components/settings/workspace-group";
import { TeamAvatars } from "#/components/teams/team-avatars";
import { TeamModal } from "#/components/teams/team-modal";
import {
	MEMBER_STATS,
	type MemberStats,
	SETTINGS,
	type SettingsData,
} from "#/graphql/operations";
import { can, ROLES } from "#/lib/permissions";
import { ROLE_LABEL } from "#/lib/preferences";
import { ago } from "#/lib/time";

// Ported from the reference app's member directory (Members, Teams, Roles & permissions).

const TABS = [
	["members", "Members"],
	["teams", "Teams"],
	["roles", "Roles & permissions"],
] as const;

export const Route = createFileRoute("/_authed/w/$slug/members/")({
	validateSearch: z.object({
		tab: z.enum(["members", "teams", "roles"]).optional(),
	}),
	loader: async ({ context, params }) => {
		const [{ data }] = await Promise.all([
			context.apolloClient.query({
				query: SETTINGS,
				variables: { slug: params.slug },
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: MEMBER_STATS,
				variables: { slug: params.slug },
				fetchPolicy: "network-only",
			}),
		]);
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Members - Zadaci" }] }),
	component: MembersPage,
});

function MembersPage() {
	const { slug } = Route.useParams();
	const { tab = "members" } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(SETTINGS, { variables: { slug } });
	const { data: statsData } = useSuspenseQuery(MEMBER_STATS, {
		variables: { slug },
	});
	const [inviting, setInviting] = useState(false);
	const [newTeam, setNewTeam] = useState(false);
	const workspace = data.workspace;
	if (!workspace) return null;
	const canAdmin = can(workspace.role, "manageRoles");
	const canInvite =
		can(workspace.role, "inviteMembers") ||
		can(workspace.role, "inviteGuests", workspace.settings);
	const canTeams = can(workspace.role, "manageTeams");
	const stats = statsData.workspace?.memberStats ?? [];
	const teamMembers = (teamId: string) =>
		workspace.members.filter((m) =>
			stats.find((s) => s.memberId === m.id)?.teamIds.includes(teamId),
		);

	return (
		<div className="page wide" style={{ maxWidth: 1200 }}>
			<div className="ph">
				<div>
					<h1>Members</h1>
					<p>
						{workspace.members.length} people in {workspace.name} ·{" "}
						{workspace.invites.length} pending
					</p>
				</div>
				{canInvite && (
					<div className="acts">
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => setInviting(true)}
						>
							<span
								className="icon-[solar--user-plus-linear] size-3.5"
								aria-hidden="true"
							/>
							Invite member
						</button>
					</div>
				)}
			</div>
			<div className="tabs" role="tablist" style={{ marginBottom: 14 }}>
				{TABS.map(([k, label]) => (
					<button
						key={k}
						type="button"
						role="tab"
						aria-selected={tab === k}
						className={tab === k ? "tab on" : "tab"}
						onClick={() =>
							navigate({
								search: { tab: k === "members" ? undefined : k },
								replace: true,
							})
						}
					>
						{label}
					</button>
				))}
			</div>
			{tab === "teams" ? (
				<>
					<div className="row" style={{ marginBottom: 12 }}>
						<span className="muted" style={{ fontSize: 13 }}>
							{workspace.teams.length} teams
						</span>
						<span className="sp" />
						{canTeams && (
							<button
								type="button"
								className="btn btn-secondary btn-sm"
								onClick={() => setNewTeam(true)}
							>
								<span
									className="icon-[hugeicons--plus-sign] size-[13px]"
									aria-hidden="true"
								/>
								New team
							</button>
						)}
					</div>
					<TeamsGrid
						slug={slug}
						teams={workspace.teams}
						avatars={(teamId) => <TeamAvatars members={teamMembers(teamId)} />}
					/>
				</>
			) : tab === "roles" ? (
				<PermissionsTable settings={workspace.settings} />
			) : (
				<MembersTable
					slug={slug}
					workspace={workspace}
					stats={stats}
					canAdmin={canAdmin}
				/>
			)}
			{canTeams && (
				<TeamModal
					open={newTeam}
					onOpenChange={setNewTeam}
					slug={slug}
					members={workspace.members}
					teams={workspace.teams}
					stats={stats}
				/>
			)}
			{canInvite && (
				<InviteModal
					open={inviting}
					onOpenChange={setInviting}
					slug={slug}
					workspace={workspace}
				/>
			)}
		</div>
	);
}

type Workspace = NonNullable<SettingsData["workspace"]>;

function MembersTable({
	slug,
	workspace,
	stats,
	canAdmin,
}: {
	slug: string;
	workspace: Workspace;
	stats: MemberStats[];
	canAdmin: boolean;
}) {
	const [q, setQ] = useState("");
	const [role, setRole] = useState<"all" | (typeof ROLES)[number]>("all");
	const query = q.trim().toLowerCase();
	const matches = (name: string, email: string) =>
		!query ||
		name.toLowerCase().includes(query) ||
		email.toLowerCase().includes(query);
	const members = workspace.members.filter(
		(m) => (role === "all" || m.role === role) && matches(m.name, m.email),
	);
	const invites = workspace.invites.filter(
		(i) => (role === "all" || i.role === role) && matches(i.email, i.email),
	);
	const teamName = (ids: string[] = []) =>
		workspace.teams.find((t) => t.id === ids[0])?.name ?? "No team";

	return (
		<>
			<div
				className="row"
				style={{ marginBottom: 12, gap: 8, flexWrap: "wrap" }}
			>
				<div className="inwrap">
					<span
						className="i icon-[solar--magnifer-linear] size-[13px]"
						aria-hidden="true"
					/>
					<input
						className="input search-sm"
						placeholder="Search by name or email"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						aria-label="Search members"
					/>
				</div>
				<div className="seg">
					{(["all", ...ROLES] as const).map((r) => (
						<button
							key={r}
							type="button"
							className={role === r ? "on" : ""}
							aria-pressed={role === r}
							onClick={() => setRole(r)}
						>
							{r === "all" ? "All" : ROLE_LABEL[r]}
						</button>
					))}
				</div>
			</div>
			<div className="panel" style={{ overflowX: "auto" }}>
				{members.length || invites.length ? (
					<table className="perm-t" style={{ minWidth: 880 }}>
						<thead>
							<tr>
								<th style={{ paddingLeft: 14 }}>Member</th>
								<th style={{ textAlign: "left" }}>Role</th>
								<th style={{ textAlign: "left" }}>Team</th>
								<th>Active projects</th>
								<th>Tasks</th>
								<th style={{ textAlign: "left" }}>Last active</th>
								<th style={{ textAlign: "left" }}>Status</th>
								<th>
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{members.map((m) => {
								const s = stats.find((x) => x.memberId === m.id);
								const last = s?.lastActiveAt;
								const online =
									!!last && Date.now() - new Date(last).getTime() < 5 * 60_000;
								return (
									<tr key={m.id}>
										<td style={{ paddingLeft: 14 }}>
											<Link
												to="/w/$slug/members/$memberId"
												params={{ slug, memberId: m.id }}
												className="row"
												style={{ gap: 10, textAlign: "left" }}
											>
												<Av name={m.name} image={m.image} className="md" />
												<span className="col">
													<b style={{ fontWeight: 500 }}>
														{m.name}
														{m.isMe && (
															<span
																className="faint"
																style={{ fontWeight: 400 }}
															>
																{" "}
																(you)
															</span>
														)}
													</b>
													<span className="faint" style={{ fontSize: 12 }}>
														{m.email}
													</span>
												</span>
											</Link>
										</td>
										<td style={{ textAlign: "left" }}>
											<MemberRole slug={slug} m={m} canAdmin={canAdmin} />
										</td>
										<td style={{ textAlign: "left" }}>
											{teamName(s?.teamIds)}
										</td>
										<td className="num">{s?.activeProjects ?? 0}</td>
										<td className="num">{s?.openTasks ?? 0}</td>
										<td style={{ textAlign: "left" }} className="muted">
											{online ? (
												<span style={{ color: "var(--q-green)" }}>Online</span>
											) : last ? (
												<span suppressHydrationWarning>{ago(last)}</span>
											) : (
												"—"
											)}
										</td>
										<td style={{ textAlign: "left" }}>
											<span className="badge green">
												<span className="dot" />
												Active
											</span>
										</td>
										<td>
											<MemberActions
												slug={slug}
												m={m}
												canAdmin={canAdmin}
												openTasks={s?.openTasks}
											/>
										</td>
									</tr>
								);
							})}
							{invites.map((i) => (
								<tr key={i.id}>
									<td style={{ paddingLeft: 14 }}>
										<span className="row" style={{ gap: 10 }}>
											<Av name={i.email} color="#6B7280" className="md" />
											<span className="col">
												<b style={{ fontWeight: 500 }}>{i.email}</b>
												<span className="faint" style={{ fontSize: 12 }}>
													Invite pending
												</span>
											</span>
										</span>
									</td>
									<td style={{ textAlign: "left" }}>
										<span className="pillbtn">{ROLE_LABEL[i.role]}</span>
									</td>
									<td style={{ textAlign: "left" }} className="faint">
										—
									</td>
									<td className="num faint">—</td>
									<td className="num faint">—</td>
									<td style={{ textAlign: "left" }} className="muted">
										—
									</td>
									<td style={{ textAlign: "left" }}>
										<span className="badge amber">
											<span className="dot" />
											Invited
										</span>
									</td>
									<td style={{ whiteSpace: "nowrap" }}>
										{can(workspace.role, "inviteMembers") && (
											<InviteActions slug={slug} id={i.id} />
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<div className="empty-state sm">
						<div className="glyph">
							<span
								className="icon-[solar--magnifer-bug-linear] size-5"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">No results found</h2>
						<p>No members match that search.</p>
					</div>
				)}
			</div>
		</>
	);
}
