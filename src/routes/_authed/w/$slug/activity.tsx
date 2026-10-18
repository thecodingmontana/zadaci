import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ActivityItem } from "#/components/activity/activity-item";
import { Select } from "#/components/settings/ui";
import { ActivitySkeleton } from "#/components/shell/page-skeletons";
import { ACTIVITY } from "#/graphql/operations";
import { prime, reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";
import { byDay } from "#/lib/time";

// Ported from the reference app's Activity page: the workspace feed, grouped by day.

const FILTERS = [
	["all", "All"],
	["status", "Status changes"],
	["comments", "Comments"],
	["projects", "Projects"],
] as const;

export const Route = createFileRoute("/_authed/w/$slug/activity")({
	validateSearch: z.object({
		filter: z.enum(["all", "status", "comments", "projects"]).optional(),
		who: z.string().optional(),
	}),
	loaderDeps: ({ search }) => search,
	shouldReload: reloadOnEnter,
	loader: ({ context, params, deps }) =>
		prime(context.apolloClient, {
			query: ACTIVITY,
			variables: {
				slug: params.slug,
				filter: deps.filter ?? "all",
				actorId: deps.who,
			},
			// the feed changes on every action; always show the latest
		}),
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Activity") }] }),
	pendingComponent: ActivitySkeleton,
	component: ActivityPage,
});

function ActivityPage() {
	const { slug } = Route.useParams();
	const { filter = "all", who } = Route.useSearch();
	const { user } = Route.useRouteContext();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(ACTIVITY, {
		variables: { slug, filter, actorId: who },
	});
	const items = data.workspace?.activity ?? [];
	const members = data.workspace?.members ?? [];

	return (
		<div className="page" style={{ maxWidth: 820 }}>
			<div className="ph">
				<div>
					<h1>Activity</h1>
					<p>Everything that's changed across the workspace.</p>
				</div>
			</div>
			<div
				className="row"
				style={{ gap: 8, marginBottom: 6, flexWrap: "wrap" }}
			>
				<div className="seg">
					{FILTERS.map(([k, label]) => (
						<button
							key={k}
							type="button"
							className={filter === k ? "on" : ""}
							aria-pressed={filter === k}
							onClick={() =>
								navigate({
									search: (s) => ({
										...s,
										filter: k === "all" ? undefined : k,
									}),
									replace: true,
								})
							}
						>
							{label}
						</button>
					))}
				</div>
				<Select
					label="Filter by person"
					className="h-[26px] w-auto min-w-0 text-xs"
					value={who ?? "all"}
					options={[
						["all", "Everyone"],
						...members.map((m) => [m.userId, m.name] as const),
					]}
					onChange={(v) =>
						navigate({
							search: (s) => ({ ...s, who: v === "all" ? undefined : v }),
							replace: true,
						})
					}
				/>
			</div>
			{items.length ? (
				byDay(items).map(([day, list]) => (
					<div key={day}>
						<div className="day-h">{day}</div>
						<div className="feed lined">
							{list.map((a) => (
								<ActivityItem key={a.id} slug={slug} a={a} meId={user.id} />
							))}
						</div>
					</div>
				))
			) : (
				<div className="empty-state">
					<div className="glyph">
						<span
							className="icon-[hugeicons--activity-01] size-5"
							aria-hidden="true"
						/>
					</div>
					<h2 className="es-h">No activity yet</h2>
					<p>Changes to tasks and projects will appear here.</p>
				</div>
			)}
		</div>
	);
}
