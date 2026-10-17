import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceTasks } from "#/components/tasks/workspace-tasks";
import { TASKS } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";

export const Route = createFileRoute("/_authed/w/$slug/calendar")({
	shouldReload: reloadOnEnter,
	// start loading without waiting, so the page opens at once with a skeleton
	loader: ({ context, params }) => {
		context.apolloClient
			.query({ query: TASKS, variables: { slug: params.slug } })
			.catch(() => {});
	},
	head: () => ({ meta: [{ title: "Calendar - Zadaci" }] }),
	component: Page,
});

function Page() {
	const { slug } = Route.useParams();
	return <WorkspaceTasks slug={slug} kind="calendar" />;
}
