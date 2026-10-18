import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AvStack } from "#/components/q/av";
import { TeamsGrid } from "#/components/settings/workspace-group";
import { TeamsSkeleton } from "#/components/shell/page-skeletons";
import { TeamModal } from "#/components/teams/team-modal";
import { MEMBER_STATS, SETTINGS } from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { prime, reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

// Ported from the reference app's Teams page.

export const Route = createFileRoute("/_authed/w/$slug/teams/")({
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const [{ data }] = await Promise.all([
			prime(context.apolloClient, {
				query: SETTINGS,
				variables: { slug: params.slug },
			}),
			prime(context.apolloClient, {
				query: MEMBER_STATS,
				variables: { slug: params.slug },
			}),
		]);
		if (!data?.workspace) throw notFound();
	},
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Teams") }] }),
	pendingComponent: TeamsSkeleton,
	component: TeamsPage,
});

function TeamsPage() {
	const { slug } = Route.useParams();
	const { data } = useSuspenseQuery(SETTINGS, { variables: { slug } });
	const { data: statsData } = useSuspenseQuery(MEMBER_STATS, {
		variables: { slug },
	});
	const [creating, setCreating] = useState(false);
	const workspace = data.workspace;
	if (!workspace) return null;
	const canAdmin = can(workspace.role, "manageTeams", workspace.settings);
	const stats = statsData.workspace?.memberStats ?? [];
	const newTeam = canAdmin && (
		<button
			type="button"
			className="btn btn-primary"
			onClick={() => setCreating(true)}
		>
			<span
				className="icon-[hugeicons--plus-sign] size-3.5"
				aria-hidden="true"
			/>
			New team
		</button>
	);

	return (
		<div className="page">
			<div className="ph">
				<div>
					<h1>Teams</h1>
					<p>Groups of people who work on projects together.</p>
				</div>
				<div className="acts">{newTeam}</div>
			</div>
			{workspace.teams.length ? (
				<TeamsGrid
					slug={slug}
					teams={workspace.teams}
					canCreate={canAdmin}
					avatars={(teamId) => (
						<AvStack
							people={workspace.members.filter((m) =>
								stats
									.find((s) => s.memberId === m.id)
									?.teamIds.includes(teamId),
							)}
						/>
					)}
				/>
			) : (
				<div className="panel">
					<div className="empty-state">
						<div className="glyph">
							<span
								className="icon-[solar--users-group-rounded-linear] size-5"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">No teams yet</h2>
						<p>Create a team to group people and give projects an owner.</p>
						{newTeam}
					</div>
				</div>
			)}
			{canAdmin && (
				<TeamModal
					open={creating}
					onOpenChange={setCreating}
					slug={slug}
					members={workspace.members}
					teams={workspace.teams}
					stats={stats}
				/>
			)}
		</div>
	);
}
