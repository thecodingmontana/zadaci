import { Link } from "@tanstack/react-router";
import { Av } from "#/components/q/av";
import type { ActivityItem as Item } from "#/graphql/operations";
import { ago } from "#/lib/time";

/** One feed line: "You archived project Atlas · 2h ago" (reference actHtml). */
export function ActivityItem({
	slug,
	a,
	meId,
}: {
	slug: string;
	a: Item;
	/** the viewer's user id, shown as "You" */
	meId: string;
}) {
	const name = a.actor
		? a.actor.id === meId
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
							// a task line opens the task itself (the drawer), not just its project
							search={a.kind === "task" && a.taskId ? { task: a.taskId } : {}}
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
