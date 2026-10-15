import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Av } from "#/components/q/av";
import { Select } from "#/components/settings/ui";
import { ACTIVITY, type ActivityItem } from "#/graphql/operations";
import { ago, byDay } from "#/lib/time";

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
	loader: ({ context, params, deps }) =>
		context.apolloClient.query({
			query: ACTIVITY,
			variables: {
				slug: params.slug,
				filter: deps.filter ?? "all",
				actorId: deps.who,
			},
			// the feed changes on every action; always show the latest
			fetchPolicy: "network-only",
		}),
	head: () => ({ meta: [{ title: "Activity - Zadaci" }] }),
	component: ActivityPage,
});

function ActivityPage() {
	const { slug } = Route.useParams();
	const { filter = "all", who } = Route.useSearch();
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
								<ActivityRow key={a.id} slug={slug} a={a} />
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

function ActivityRow({ slug, a }: { slug: string; a: ActivityItem }) {
	const { user } = Route.useRouteContext();
	const name = a.actor
		? a.actor.id === user.id
			? "You"
			: a.actor.name
		: "Someone";
	return (
		<div className="fitem">
			<Av name={a.actor?.name ?? "?"} image={a.actor?.image} className="sm" />
			<div className="grow">
				<b>{name}</b> <span className="muted">{a.verb}</span>{" "}
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
	);
}
