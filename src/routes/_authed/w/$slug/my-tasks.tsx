import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceTasks } from "#/components/tasks/workspace-tasks";
import { TASKS } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

export const Route = createFileRoute("/_authed/w/$slug/my-tasks")({
	shouldReload: reloadOnEnter,
	// start loading without waiting, so the page opens at once with a skeleton
	loader: ({ context, params }) => {
		context.apolloClient
			.query({ query: TASKS, variables: { slug: params.slug } })
			.catch(() => {});
	},
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "My Tasks") }] }),
	component: Page,
});

function Page() {
	const { slug } = Route.useParams();
	return <WorkspaceTasks slug={slug} kind="my" />;
}
