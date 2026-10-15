import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Av } from "#/components/q/av";
import { InviteModal } from "#/components/settings/workspace-group";
import { TeamModal } from "#/components/teams/team-modal";
import {
	MEMBER_STATS,
	SETTINGS,
	WORKSPACE_PROJECTS,
} from "#/graphql/operations";
import { PCOLORS } from "#/lib/onboarding";
import { isAdmin, ROLE_LABEL } from "#/lib/preferences";
import { cn } from "#/lib/utils";

// Ported from the reference app's team page: projects and members of one team.

export const Route = createFileRoute("/_authed/w/$slug/teams/$teamId")({
	loader: async ({ context, params }) => {
		const variables = { slug: params.slug };
		const [{ data }] = await Promise.all([
			context.apolloClient.query({
				query: SETTINGS,
				variables,
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: MEMBER_STATS,
				variables,
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: WORKSPACE_PROJECTS,
				variables,
				fetchPolicy: "network-only",
			}),
		]);
		const team = data?.workspace?.teams.find((t) => t.id === params.teamId);
		if (!team) throw notFound();
		return { name: team.name };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.name ?? "Team"} - Zadaci` }],
	}),
	component: TeamPage,
});

const PROJECT_STATUS: Record<string, string> = {
	idea: "Idea",
	todo: "Planned",
	in_progress: "In progress",
	in_review: "In review",
	completed: "Completed",
	abandoned: "Abandoned",
};

function TeamPage() {
	const { slug, teamId } = Route.useParams();
	const variables = { slug };
	const { data } = useSuspenseQuery(SETTINGS, { variables });
	const { data: statsData } = useSuspenseQuery(MEMBER_STATS, { variables });
	const { data: projectsData } = useSuspenseQuery(WORKSPACE_PROJECTS, {
		variables,
	});
	const [editing, setEditing] = useState(false);
	const [inviting, setInviting] = useState(false);
	const workspace = data.workspace;
	const team = workspace?.teams.find((t) => t.id === teamId);
	if (!workspace || !team) return null;
	const canAdmin = isAdmin(workspace.role);
	const stats = statsData.workspace?.memberStats ?? [];
	const members = workspace.members.filter((m) =>
		stats.find((s) => s.memberId === m.id)?.teamIds.includes(team.id),
	);
	const projects = (projectsData.workspace?.projects ?? []).filter(
		(p) => p.teamId === team.id,
	);
	const color = PCOLORS[team.color ?? ""] ?? team.color ?? PCOLORS.teal;

	return (
		<div className="page">
			<div className="ph">
				<div className="row" style={{ gap: 12 }}>
					<span
						className="picon lg"
						style={{ "--c": color } as React.CSSProperties}
					>
						<span
							className={cn(
								team.icon ?? "icon-[solar--users-group-rounded-linear]",
								"size-[18px]",
							)}
							aria-hidden="true"
						/>
					</span>
					<div>
						<h1>{team.name}</h1>
						<p style={{ margin: "2px 0 0" }}>
							{team.description || "No description yet."}
						</p>
					</div>
				</div>
				{canAdmin && (
					<div className="acts">
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setEditing(true)}
						>
							<span
								className="icon-[solar--pen-linear] size-3.5"
								aria-hidden="true"
							/>
							Edit team
						</button>
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setInviting(true)}
						>
							<span
								className="icon-[solar--user-plus-linear] size-3.5"
								aria-hidden="true"
							/>
							Invite to workspace
						</button>
					</div>
				)}
			</div>
			<div className="grid2">
				<section className="panel" style={{ alignSelf: "start" }}>
					<div className="panel-h">
						<h2>Projects</h2>
						<span className="faint">{projects.length}</span>
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
											"--c": PCOLORS[p.color ?? ""] ?? PCOLORS.indigo,
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
									{PROJECT_STATUS[p.status] ?? p.status}
								</span>
							</Link>
						))
					) : (
						<div className="panel-b faint">No projects</div>
					)}
				</section>
				<section className="panel" style={{ alignSelf: "start" }}>
					<div className="panel-h">
						<h2>Members</h2>
						<span className="faint">{members.length}</span>
					</div>
					{members.length ? (
						members.map((m) => (
							<Link
								key={m.id}
								to="/w/$slug/members/$memberId"
								params={{ slug, memberId: m.id }}
								className="mini"
								style={{ minHeight: 48 }}
							>
								<Av name={m.name} image={m.image} className="md" />
								<div className="grow">
									<div style={{ fontWeight: 500 }}>{m.name}</div>
									{m.title && (
										<div className="faint" style={{ fontSize: 12 }}>
											{m.title}
										</div>
									)}
								</div>
								<span className="badge">{ROLE_LABEL[m.role]}</span>
							</Link>
						))
					) : (
						<div className="panel-b faint">No members yet</div>
					)}
				</section>
			</div>
			{canAdmin && (
				<>
					<TeamModal
						open={editing}
						onOpenChange={setEditing}
						slug={slug}
						team={team}
						members={workspace.members}
						teams={workspace.teams}
						stats={stats}
					/>
					<InviteModal
						open={inviting}
						onOpenChange={setInviting}
						slug={slug}
						workspace={workspace}
					/>
				</>
			)}
		</div>
	);
}
